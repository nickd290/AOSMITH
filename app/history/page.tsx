'use client'

import { Suspense, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { FileText, Tag, Package, X, Truck, Calendar, Receipt, Download, Loader2, Trash2, CheckCircle2, ExternalLink } from 'lucide-react'

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
  customerPackingSlipUrl?: string | null
  customerPackingSlipName?: string | null
  customerPackingSlipUploadedAt?: string | null
  proNumber?: string | null
  carrier?: string | null
  shippedAt?: string | null
  shippedByUserId?: string | null
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
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-brand-cream">
          <div className="text-sm tracking-widest uppercase text-brand-ink-mute">Loading…</div>
        </div>
      }
    >
      <HistoryPageInner />
    </Suspense>
  )
}

function HistoryPageInner() {
  const { user, isAuthenticated, isLoading: authLoading, token } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
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

  // Download state
  const [downloadingDoc, setDownloadingDoc] = useState<string | null>(null)

  // Delete state
  const [isDeleting, setIsDeleting] = useState(false)

  // Mark Shipped state (Apr 2026 EPG new process — replaces customer packing-slip upload)
  const [isMarkingShipped, setIsMarkingShipped] = useState(false)
  const [showMarkShippedForm, setShowMarkShippedForm] = useState(false)
  const [proNumberInput, setProNumberInput] = useState('')
  const [carrierInput, setCarrierInput] = useState('XPO')
  const [shipDateInput, setShipDateInput] = useState('')

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
      setProNumberInput(selectedRelease.proNumber || '')
      setCarrierInput(selectedRelease.carrier || 'XPO')
      setShipDateInput(new Date().toISOString().split('T')[0])
      setShowMarkShippedForm(false)
    }
  }, [selectedRelease])

  // Deep links from email: ?openRelease=<id> opens the sidebar; ?markShip=<id> also opens the Mark Shipped form.
  useEffect(() => {
    if (!releases.length || !searchParams) return
    const openId = searchParams.get('openRelease') || searchParams.get('markShip')
    if (!openId) return
    const target = releases.find((r) => r.id === openId)
    if (target) {
      setSelectedRelease(target)
      if (searchParams.get('markShip')) {
        setShowMarkShippedForm(true)
      }
    }
  }, [releases, searchParams])

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

  const downloadDocument = async (releaseId: string, docType: 'packing-slip' | 'box-labels' | 'invoice') => {
    setDownloadingDoc(`${releaseId}-${docType}`)
    try {
      const response = await fetch(`/api/releases/${releaseId}/download/${docType}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to download document')
      }

      // Get the blob and create a download link
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition')
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
      a.download = filenameMatch ? filenameMatch[1] : `${docType}-${releaseId}.pdf`

      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error downloading document:', err)
      alert('Failed to download document. Please try again.')
    } finally {
      setDownloadingDoc(null)
    }
  }

  const deleteRelease = async () => {
    if (!selectedRelease) return

    if (!confirm(`Are you sure you want to delete release ${selectedRelease.releaseNumber}?\n\nThis will restore ${selectedRelease.pallets} pallets to inventory.\n\nThis action cannot be undone.`)) {
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/releases/${selectedRelease.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete release')
      }

      // Remove from list and close sidebar
      setReleases(releases.filter(r => r.id !== selectedRelease.id))
      setSelectedRelease(null)
      alert('Release deleted successfully. Inventory has been restored.')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete release')
    } finally {
      setIsDeleting(false)
    }
  }

  const markShipped = async () => {
    if (!selectedRelease) return
    if (!proNumberInput.trim()) {
      alert('PRO # is required.')
      return
    }
    if (!confirm(`Mark ${selectedRelease.releaseNumber} as SHIPPED?\n\nPRO #: ${proNumberInput.trim()}\nCarrier: ${carrierInput || 'XPO'}\nShip date: ${shipDateInput}\n\nThis will send a confirmation email to EPG.`)) {
      return
    }

    setIsMarkingShipped(true)
    try {
      const response = await fetch(`/api/releases/${selectedRelease.id}/mark-shipped`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          proNumber: proNumberInput.trim(),
          carrier: carrierInput.trim() || 'XPO',
          shipDate: shipDateInput || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to mark shipped')
      }

      const data = await response.json()
      setReleases(releases.map((r) => (r.id === data.release.id ? data.release : r)))
      setSelectedRelease(data.release)
      setShowMarkShippedForm(false)
      alert('Marked SHIPPED. Confirmation email sent to EPG (Alecia + cc Kirk + JD team).')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to mark shipped')
    } finally {
      setIsMarkingShipped(false)
    }
  }

  const openJdPaperwork = (releaseId: string) => {
    if (!token) return
    const url = `/api/releases/${releaseId}/jd-paperwork?token=${encodeURIComponent(token)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const openPalletFlags = (releaseId: string) => {
    if (!token) return
    const url = `/api/releases/${releaseId}/load-flags?token=${encodeURIComponent(token)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const downloadReleasesXlsx = () => {
    if (!token) return
    const url = `/api/releases/export?token=${encodeURIComponent(token)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-cream">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  const uniqueParts = Array.from(new Set(releases.map((r) => r.part.partNumber)))
  const uniqueLocations = Array.from(new Set(releases.map((r) => r.shippingLocation.name)))

  // Using dynamic boxesPerPallet from each part instead of hardcoded value

  return (
    <div className="min-h-screen bg-brand-cream">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-brand-rule">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-brand-ink">Release History</h1>
            <p className="text-sm text-brand-ink-mute mt-1">Click on a release to view details and update shipping info</p>
          </div>
          <div className="flex items-center gap-4">
            {user?.role === 'ADMIN' && (
              <button
                onClick={downloadReleasesXlsx}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white text-sm font-medium rounded-lg hover:bg-emerald-800"
              >
                Download Excel
              </button>
            )}
            <Link href="/dashboard" className="text-brand-rust hover:text-brand-rust-dark">
              ← Back to Dashboard
            </Link>
          </div>
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
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-brand-ink mb-4">Filter Releases</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-brand-ink-soft mb-2">
                  Search by Release #, Part # or PO#
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="REL-20250101-0001 or PO#"
                  className="w-full px-4 py-2 border border-brand-rule rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-ink-soft mb-2">Part Number</label>
                <select
                  value={selectedPart}
                  onChange={(e) => setSelectedPart(e.target.value)}
                  className="w-full px-4 py-2 border border-brand-rule rounded-lg"
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
                <label className="block text-sm font-medium text-brand-ink-soft mb-2">Location</label>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full px-4 py-2 border border-brand-rule rounded-lg"
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
                className="mt-4 text-sm text-brand-rust hover:text-brand-rust-dark"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Releases List */}
          {isLoading ? (
            <div className="text-center py-12 text-brand-ink-mute">Loading releases...</div>
          ) : filteredReleases.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <p className="text-brand-ink-mute mb-4">
                {releases.length === 0 ? 'No releases found' : 'No releases match your filters'}
              </p>
              {releases.length === 0 && (
                <Link
                  href="/release"
                  className="inline-block px-6 py-3 bg-brand-rust text-white font-semibold rounded-lg hover:bg-brand-rust-dark"
                >
                  Create Your First Release
                </Link>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-brand-rule">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-brand-ink-mute uppercase tracking-wider">
                        Release #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-brand-ink-mute uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-brand-ink-mute uppercase tracking-wider">
                        Part
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-brand-ink-mute uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-brand-ink-mute uppercase tracking-wider">
                        Location
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-brand-ink-mute uppercase tracking-wider">
                        Ship Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-brand-ink-mute uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-brand-ink-mute uppercase tracking-wider">
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
                            ? 'bg-brand-rust-soft border-l-4 border-brand-rust'
                            : 'hover:bg-brand-cream-deep'
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-brand-ink">
                          {release.releaseNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-ink-mute">
                          {new Date(release.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-ink">
                          <div>#{release.part.partNumber}</div>
                          <div className="text-xs text-brand-ink-mute">{release.part.description}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-ink-mute">
                          <div>{release.pallets} pallets</div>
                          <div className="text-xs text-brand-ink-mute">
                            {release.totalUnits.toLocaleString()} units
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-brand-ink-mute">
                          <div>{release.shippingLocation.name}</div>
                          <div className="text-xs text-brand-ink-mute">
                            {release.shippingLocation.city}, {release.shippingLocation.state}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-ink-mute">
                          {release.shipDate
                            ? new Date(release.shipDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
                            : <span className="text-gray-400">-</span>}
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-ink-mute">
                          {release.trackingNumber ? (
                            <span className="text-brand-rust">{release.trackingNumber}</span>
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
            <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-brand-ink mb-4">Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-brand-ink-mute mb-1">Total Releases</p>
                  <p className="text-2xl font-bold text-brand-ink">{filteredReleases.length}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-brand-ink-mute mb-1">Total Pallets</p>
                  <p className="text-2xl font-bold text-brand-ink">
                    {filteredReleases.reduce((sum, r) => sum + r.pallets, 0)}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-brand-ink-mute mb-1">Total Units</p>
                  <p className="text-2xl font-bold text-brand-ink">
                    {filteredReleases.reduce((sum, r) => sum + r.totalUnits, 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Details Sidebar */}
        {selectedRelease && (
          <aside className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl border-l border-brand-rule overflow-y-auto z-50">
            <div className="p-6">
              {/* Header */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold text-brand-ink">{selectedRelease.releaseNumber}</h2>
                  <p className="text-sm text-brand-ink-mute">
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
                  className="p-2 hover:bg-brand-cream-deep rounded-full"
                >
                  <X className="w-5 h-5 text-brand-ink-mute" />
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
                <h3 className="font-semibold text-brand-ink mb-2">Part Information</h3>
                <p className="text-lg font-bold text-brand-rust">#{selectedRelease.part.partNumber}</p>
                <p className="text-sm text-brand-ink-mute">{selectedRelease.part.description}</p>
                <div className="mt-2 text-sm text-brand-ink-mute">
                  {selectedRelease.part.unitsPerBox} units/box • {selectedRelease.part.boxesPerPallet} boxes/skid
                </div>
              </div>

              {/* Quantity */}
              <div className="mb-6 grid grid-cols-2 gap-4">
                <div className="p-4 bg-brand-rust-soft rounded-lg">
                  <p className="text-sm text-brand-rust">Pallets</p>
                  <p className="text-2xl font-bold text-brand-ink">{selectedRelease.pallets}</p>
                </div>
                <div className="p-4 bg-brand-rust-soft rounded-lg">
                  <p className="text-sm text-brand-rust">Total Units</p>
                  <p className="text-2xl font-bold text-brand-ink">
                    {selectedRelease.totalUnits.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Shipping Info */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-brand-ink mb-2">Ship To</h3>
                <p className="font-medium">{selectedRelease.shippingLocation.name}</p>
                <p className="text-sm text-brand-ink-mute">{selectedRelease.shippingLocation.address}</p>
                <p className="text-sm text-brand-ink-mute">
                  {selectedRelease.shippingLocation.city}, {selectedRelease.shippingLocation.state}{' '}
                  {selectedRelease.shippingLocation.zip}
                </p>
              </div>

              {/* Order Details */}
              <div className="mb-6 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-brand-ink-mute">Customer PO#:</span>
                  <span className="font-medium">{selectedRelease.customerPONumber}</span>
                </div>
                {selectedRelease.ticketNumber && (
                  <div className="flex justify-between text-sm">
                    <span className="text-brand-ink-mute">Ticket #:</span>
                    <span className="font-medium">{selectedRelease.ticketNumber}</span>
                  </div>
                )}
                {selectedRelease.batchNumber && (
                  <div className="flex justify-between text-sm">
                    <span className="text-brand-ink-mute">Batch #:</span>
                    <span className="font-medium">{selectedRelease.batchNumber}</span>
                  </div>
                )}
                {selectedRelease.shipVia && (
                  <div className="flex justify-between text-sm">
                    <span className="text-brand-ink-mute">Ship Via:</span>
                    <span className="font-medium">{selectedRelease.shipVia}</span>
                  </div>
                )}
                {selectedRelease.freightTerms && (
                  <div className="flex justify-between text-sm">
                    <span className="text-brand-ink-mute">Freight Terms:</span>
                    <span className="font-medium">{selectedRelease.freightTerms}</span>
                  </div>
                )}
              </div>

              {/* Shipping Update Form */}
              <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h3 className="font-semibold text-brand-ink mb-4 flex items-center gap-2">
                  <Truck className="w-5 h-5" />
                  Shipping Information
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-brand-ink-soft mb-1">
                      Tracking Number
                    </label>
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="Enter tracking number"
                      className="w-full px-3 py-2 border border-brand-rule rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-brand-ink-soft mb-1">
                      Ship Date
                    </label>
                    <input
                      type="date"
                      value={shipDate}
                      onChange={(e) => setShipDate(e.target.value)}
                      className="w-full px-3 py-2 border border-brand-rule rounded-lg"
                    />
                  </div>
                  <button
                    onClick={updateRelease}
                    disabled={isUpdating}
                    className="w-full px-4 py-2 bg-brand-rust text-white font-medium rounded-lg hover:bg-brand-rust-dark disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUpdating ? 'Updating...' : 'Update Shipping Info'}
                  </button>
                </div>
              </div>

              {/* JD Shipment Paperwork (Apr 2026 EPG new process) */}
              {user?.role === 'ADMIN' && (
                <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <h3 className="font-semibold text-brand-ink mb-2 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-slate-700" />
                    JD Shipment Paperwork
                  </h3>
                  <p className="text-xs text-brand-ink-mute mb-3">
                    JD-branded packing slip + BOL + one pallet flag per skid for XPO pickup. Print and attach flags to skids before pickup.
                  </p>
                  <button
                    onClick={() => openJdPaperwork(selectedRelease.id)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open JD Paperwork ({2 + selectedRelease.pallets} pages: Slip + BOL + {selectedRelease.pallets} Flag{selectedRelease.pallets === 1 ? '' : 's'})
                  </button>
                </div>
              )}

              {/* Mark Shipped (Apr 2026 EPG new process — admin only) */}
              {user?.role === 'ADMIN' && (
                <div className="mb-6 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                  <h3 className="font-semibold text-brand-ink mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                    Mark Shipped
                  </h3>
                  {selectedRelease.status === 'SHIPPED' ? (
                    <div className="space-y-2">
                      <div className="p-3 bg-white border border-emerald-200 rounded-lg">
                        <div className="text-xs text-brand-ink-mute uppercase tracking-wider">PRO #</div>
                        <div className="text-lg font-bold text-emerald-800">{selectedRelease.proNumber || selectedRelease.trackingNumber || '—'}</div>
                        <div className="text-xs text-brand-ink-mute mt-1">
                          {selectedRelease.carrier || 'XPO'}
                          {selectedRelease.shippedAt
                            ? ` • Shipped ${new Date(selectedRelease.shippedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                            : ''}
                        </div>
                      </div>
                    </div>
                  ) : showMarkShippedForm ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-brand-ink-soft mb-1">Carrier PRO #</label>
                        <input
                          type="text"
                          value={proNumberInput}
                          onChange={(e) => setProNumberInput(e.target.value)}
                          placeholder="e.g. 1234567890"
                          className="w-full px-3 py-2 text-sm border border-brand-rule rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-brand-ink-soft mb-1">Carrier</label>
                        <input
                          type="text"
                          value={carrierInput}
                          onChange={(e) => setCarrierInput(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-brand-rule rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-brand-ink-soft mb-1">Ship Date</label>
                        <input
                          type="date"
                          value={shipDateInput}
                          onChange={(e) => setShipDateInput(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-brand-rule rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={markShipped}
                          disabled={isMarkingShipped || !proNumberInput.trim()}
                          className="flex-1 px-3 py-2 bg-emerald-700 text-white text-sm font-medium rounded-lg hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isMarkingShipped ? 'Marking…' : 'Confirm Shipped'}
                        </button>
                        <button
                          onClick={() => setShowMarkShippedForm(false)}
                          disabled={isMarkingShipped}
                          className="px-3 py-2 bg-white border border-brand-rule text-brand-ink-soft text-sm font-medium rounded-lg hover:bg-brand-cream-deep"
                        >
                          Cancel
                        </button>
                      </div>
                      <p className="text-xs text-brand-ink-mute">
                        Sends a confirmation email to Alecia (cc Kirk + JD team) with the PRO #.
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowMarkShippedForm(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-700 text-white font-medium rounded-lg hover:bg-emerald-800"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Mark Shipped
                    </button>
                  )}
                </div>
              )}

              {/* Documents */}
              <div className="mb-6">
                <h3 className="font-semibold text-brand-ink mb-4">Documents</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => downloadDocument(selectedRelease.id, 'packing-slip')}
                    disabled={downloadingDoc === `${selectedRelease.id}-packing-slip`}
                    className="flex items-center gap-2 p-3 bg-white border border-brand-rule rounded-lg hover:bg-brand-cream-deep w-full disabled:opacity-50"
                  >
                    {downloadingDoc === `${selectedRelease.id}-packing-slip` ? (
                      <Loader2 className="w-5 h-5 text-brand-rust animate-spin" />
                    ) : (
                      <FileText className="w-5 h-5 text-brand-rust" />
                    )}
                    <span className="font-medium">Packing Slip</span>
                    <Download className="w-4 h-4 ml-auto text-gray-400" />
                  </button>
                  <button
                    onClick={() => downloadDocument(selectedRelease.id, 'box-labels')}
                    disabled={downloadingDoc === `${selectedRelease.id}-box-labels`}
                    className="flex items-center gap-2 p-3 bg-white border border-brand-rule rounded-lg hover:bg-brand-cream-deep w-full disabled:opacity-50"
                  >
                    {downloadingDoc === `${selectedRelease.id}-box-labels` ? (
                      <Loader2 className="w-5 h-5 text-green-600 animate-spin" />
                    ) : (
                      <Tag className="w-5 h-5 text-green-600" />
                    )}
                    <span className="font-medium">
                      Box Labels ({selectedRelease.pallets * selectedRelease.part.boxesPerPallet + selectedRelease.boxes} labels)
                    </span>
                    <Download className="w-4 h-4 ml-auto text-gray-400" />
                  </button>
                  <button
                    onClick={() => downloadDocument(selectedRelease.id, 'invoice')}
                    disabled={downloadingDoc === `${selectedRelease.id}-invoice`}
                    className="flex items-center gap-2 p-3 bg-white border border-brand-rule rounded-lg hover:bg-brand-cream-deep w-full disabled:opacity-50"
                  >
                    {downloadingDoc === `${selectedRelease.id}-invoice` ? (
                      <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
                    ) : (
                      <Receipt className="w-5 h-5 text-purple-600" />
                    )}
                    <span className="font-medium">Invoice to EPrint Group</span>
                    <Download className="w-4 h-4 ml-auto text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Invoice Total */}
              {selectedRelease.part.pricePerUnit && (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h3 className="font-semibold text-brand-ink mb-2">Invoice Total</h3>
                  <p className="text-2xl font-bold text-green-700">
                    ${(selectedRelease.totalUnits * selectedRelease.part.pricePerUnit).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                  <p className="text-sm text-brand-ink-mute mt-1">
                    {selectedRelease.totalUnits.toLocaleString()} units × $
                    {selectedRelease.part.pricePerUnit.toFixed(4)}/unit
                  </p>
                </div>
              )}

              {/* Released By */}
              {user?.role === 'ADMIN' && (
                <div className="mt-6 pt-4 border-t border-brand-rule">
                  <p className="text-sm text-brand-ink-mute">
                    Released by: <span className="font-medium">{selectedRelease.user.name}</span>
                  </p>
                  <p className="text-xs text-brand-ink-mute">{selectedRelease.user.email}</p>
                </div>
              )}

              {/* Delete Button - Admin Only, Non-Shipped */}
              {user?.role === 'ADMIN' && selectedRelease.status !== 'SHIPPED' && (
                <div className="mt-6 pt-4 border-t border-red-200">
                  <button
                    onClick={deleteRelease}
                    disabled={isDeleting}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                    {isDeleting ? 'Deleting...' : 'Delete Release'}
                  </button>
                  <p className="text-xs text-brand-ink-mute mt-2 text-center">
                    This will restore inventory and cannot be undone
                  </p>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
