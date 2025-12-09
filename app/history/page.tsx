'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FileText, Tag, Package, X, Truck, Calendar, Receipt } from 'lucide-react'

interface Release {
  id: string
  releaseNumber: string
  pallets: number
  boxes: number
  totalUnits: number
  status: string
  createdAt: string
  customerPONumber: string
  ticketNumber?: string | null
  batchNumber?: string | null
  shipVia?: string | null
  freightTerms?: string | null
  paymentTerms?: string | null
  trackingNumber?: string | null
  shipDate?: string | null
  packingSlipUrl?: string | null
  boxLabelsUrl?: string | null
  invoiceUrl?: string | null
  documentsGenerated?: string | null
  part: {
    partNumber: string
    description: string
    unitsPerBox: number
    boxesPerPallet: number
    pricePerUnit: number
  }
  shippingLocation: {
    name: string
    address: string
    city: string
    state: string
    zip: string
  }
  user: {
    name: string
    email: string
  }
}

export default function HistoryPage() {
  const { user, isAuthenticated, isLoading: authLoading, token } = useAuth()
  const router = useRouter()
  const [releases, setReleases] = useState<Release[]>([])
  const [filteredReleases, setFilteredReleases] = useState<Release[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  // Sidebar state
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [trackingNumber, setTrackingNumber] = useState('')
  const [shipDate, setShipDate] = useState('')

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPart, setSelectedPart] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('')

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, authLoading, router])

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchReleases()
    }
  }, [isAuthenticated, token])

  useEffect(() => {
    filterReleases()
  }, [releases, searchTerm, selectedPart, selectedLocation])

  // Update form when release is selected
  useEffect(() => {
    if (selectedRelease) {
      setTrackingNumber(selectedRelease.trackingNumber || '')
      setShipDate(selectedRelease.shipDate ? selectedRelease.shipDate.split('T')[0] : '')
    }
  }, [selectedRelease])

  const fetchReleases = async () => {
    try {
      const response = await fetch('/api/releases', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch releases')
      }

      const data = await response.json()
      setReleases(data.releases)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load releases')
    } finally {
      setIsLoading(false)
    }
  }

  const filterReleases = () => {
    let filtered = releases

    if (searchTerm) {
      filtered = filtered.filter(
        (r) =>
          r.releaseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.part.partNumber.includes(searchTerm) ||
          r.customerPONumber.includes(searchTerm)
      )
    }

    if (selectedPart) {
      filtered = filtered.filter((r) => r.part.partNumber === selectedPart)
    }

    if (selectedLocation) {
      filtered = filtered.filter((r) => r.shippingLocation.name === selectedLocation)
    }

    setFilteredReleases(filtered)
  }

  const generateDocuments = async (releaseId: string) => {
    try {
      const response = await fetch(`/api/releases/${releaseId}/documents`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentType: 'all' }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate documents')
      }

      await fetchReleases()
    } catch (err) {
      console.error('Error generating documents:', err)
      alert('Failed to generate documents. Please try again.')
    }
  }

  const updateRelease = async () => {
    if (!selectedRelease) return

    setIsUpdating(true)
    try {
      const response = await fetch(`/api/releases/${selectedRelease.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trackingNumber: trackingNumber || null,
          shipDate: shipDate || null,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update release')
      }

      const data = await response.json()

      // Update the release in the list
      setReleases(releases.map(r => r.id === data.release.id ? data.release : r))
      setSelectedRelease(data.release)

      alert('Release updated successfully!')
    } catch (err) {
      console.error('Error updating release:', err)
      alert('Failed to update release. Please try again.')
    } finally {
      setIsUpdating(false)
    }
  }

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  const uniqueParts = Array.from(new Set(releases.map((r) => r.part.partNumber)))
  const uniqueLocations = Array.from(new Set(releases.map((r) => r.shippingLocation.name)))

  const BOXES_PER_SKID = 68

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Release History</h1>
            <p className="text-sm text-gray-600 mt-1">Click on a release to view details and update shipping info</p>
          </div>
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-700">
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      <div className="flex">
        {/* Main Content */}
        <main className={`flex-1 px-4 sm:px-6 lg:px-8 py-8 transition-all duration-300 ${selectedRelease ? 'mr-96' : ''}`}>
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Filter Releases</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search by Release #, Part # or PO#
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="REL-20250101-0001 or PO#"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Part Number</label>
                <select
                  value={selectedPart}
                  onChange={(e) => setSelectedPart(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">All Parts</option>
                  {uniqueParts.map((part) => (
                    <option key={part} value={part}>
                      {part}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">All Locations</option>
                  {uniqueLocations.map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {(searchTerm || selectedPart || selectedLocation) && (
              <button
                onClick={() => {
                  setSearchTerm('')
                  setSelectedPart('')
                  setSelectedLocation('')
                }}
                className="mt-4 text-sm text-blue-600 hover:text-blue-700"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Releases List */}
          {isLoading ? (
            <div className="text-center py-12 text-gray-600">Loading releases...</div>
          ) : filteredReleases.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <p className="text-gray-600 mb-4">
                {releases.length === 0 ? 'No releases found' : 'No releases match your filters'}
              </p>
              {releases.length === 0 && (
                <Link
                  href="/release"
                  className="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
                >
                  Create Your First Release
                </Link>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Release #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Part
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Location
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tracking
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredReleases.map((release) => (
                      <tr
                        key={release.id}
                        onClick={() => setSelectedRelease(release)}
                        className={`cursor-pointer transition-colors ${
                          selectedRelease?.id === release.id
                            ? 'bg-blue-50 border-l-4 border-blue-500'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {release.releaseNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(release.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>#{release.part.partNumber}</div>
                          <div className="text-xs text-gray-500">{release.part.description}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          <div>{release.pallets} pallets</div>
                          <div className="text-xs text-gray-500">
                            {release.totalUnits.toLocaleString()} units
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          <div>{release.shippingLocation.name}</div>
                          <div className="text-xs text-gray-500">
                            {release.shippingLocation.city}, {release.shippingLocation.state}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              release.status === 'SHIPPED'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {release.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {release.trackingNumber ? (
                            <span className="text-blue-600">{release.trackingNumber}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Summary */}
          {filteredReleases.length > 0 && (
            <div className="mt-6 bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Total Releases</p>
                  <p className="text-2xl font-bold text-gray-900">{filteredReleases.length}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Total Pallets</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {filteredReleases.reduce((sum, r) => sum + r.pallets, 0)}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Total Units</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {filteredReleases.reduce((sum, r) => sum + r.totalUnits, 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Details Sidebar */}
        {selectedRelease && (
          <aside className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl border-l border-gray-200 overflow-y-auto z-50">
            <div className="p-6">
              {/* Header */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedRelease.releaseNumber}</h2>
                  <p className="text-sm text-gray-600">
                    {new Date(selectedRelease.createdAt).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedRelease(null)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Status Badge */}
              <div className="mb-6">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    selectedRelease.status === 'SHIPPED'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {selectedRelease.status}
                </span>
              </div>

              {/* Part Info */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Part Information</h3>
                <p className="text-lg font-bold text-blue-600">#{selectedRelease.part.partNumber}</p>
                <p className="text-sm text-gray-600">{selectedRelease.part.description}</p>
                <div className="mt-2 text-sm text-gray-500">
                  {selectedRelease.part.unitsPerBox} units/box • {BOXES_PER_SKID} boxes/skid
                </div>
              </div>

              {/* Quantity */}
              <div className="mb-6 grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-600">Pallets</p>
                  <p className="text-2xl font-bold text-blue-900">{selectedRelease.pallets}</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-600">Total Units</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {selectedRelease.totalUnits.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Shipping Info */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Ship To</h3>
                <p className="font-medium">{selectedRelease.shippingLocation.name}</p>
                <p className="text-sm text-gray-600">{selectedRelease.shippingLocation.address}</p>
                <p className="text-sm text-gray-600">
                  {selectedRelease.shippingLocation.city}, {selectedRelease.shippingLocation.state}{' '}
                  {selectedRelease.shippingLocation.zip}
                </p>
              </div>

              {/* Order Details */}
              <div className="mb-6 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Customer PO#:</span>
                  <span className="font-medium">{selectedRelease.customerPONumber}</span>
                </div>
                {selectedRelease.ticketNumber && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Ticket #:</span>
                    <span className="font-medium">{selectedRelease.ticketNumber}</span>
                  </div>
                )}
                {selectedRelease.batchNumber && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Batch #:</span>
                    <span className="font-medium">{selectedRelease.batchNumber}</span>
                  </div>
                )}
                {selectedRelease.shipVia && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Ship Via:</span>
                    <span className="font-medium">{selectedRelease.shipVia}</span>
                  </div>
                )}
                {selectedRelease.freightTerms && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Freight Terms:</span>
                    <span className="font-medium">{selectedRelease.freightTerms}</span>
                  </div>
                )}
              </div>

              {/* Shipping Update Form */}
              <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Truck className="w-5 h-5" />
                  Shipping Information
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      FedEx Tracking Number
                    </label>
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="Enter tracking number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ship Date
                    </label>
                    <input
                      type="date"
                      value={shipDate}
                      onChange={(e) => setShipDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <button
                    onClick={updateRelease}
                    disabled={isUpdating}
                    className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUpdating ? 'Updating...' : 'Update Shipping Info'}
                  </button>
                </div>
              </div>

              {/* Documents */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-4">Documents</h3>
                <div className="space-y-2">
                  {selectedRelease.packingSlipUrl ? (
                    <a
                      href={selectedRelease.packingSlipUrl}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <FileText className="w-5 h-5 text-blue-600" />
                      <span className="font-medium">Packing Slip</span>
                    </a>
                  ) : null}
                  {selectedRelease.boxLabelsUrl ? (
                    <a
                      href={selectedRelease.boxLabelsUrl}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <Tag className="w-5 h-5 text-green-600" />
                      <span className="font-medium">
                        Box Labels ({selectedRelease.pallets * BOXES_PER_SKID + selectedRelease.boxes} labels)
                      </span>
                    </a>
                  ) : null}
                  {selectedRelease.invoiceUrl ? (
                    <a
                      href={selectedRelease.invoiceUrl}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <Receipt className="w-5 h-5 text-purple-600" />
                      <span className="font-medium">Invoice to EPrint Group</span>
                    </a>
                  ) : null}
                  {!selectedRelease.packingSlipUrl && !selectedRelease.boxLabelsUrl && (
                    <button
                      onClick={() => generateDocuments(selectedRelease.id)}
                      className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 w-full"
                    >
                      <Package className="w-5 h-5 text-blue-600" />
                      <span className="font-medium text-blue-700">Generate Documents</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Invoice Total */}
              {selectedRelease.part.pricePerUnit && (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h3 className="font-semibold text-gray-900 mb-2">Invoice Total</h3>
                  <p className="text-2xl font-bold text-green-700">
                    ${(selectedRelease.totalUnits * selectedRelease.part.pricePerUnit).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedRelease.totalUnits.toLocaleString()} units × $
                    {selectedRelease.part.pricePerUnit.toFixed(4)}/unit
                  </p>
                </div>
              )}

              {/* Released By */}
              {user?.role === 'ADMIN' && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    Released by: <span className="font-medium">{selectedRelease.user.name}</span>
                  </p>
                  <p className="text-xs text-gray-500">{selectedRelease.user.email}</p>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
