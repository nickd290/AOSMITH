'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FileText, Tag, Package } from 'lucide-react'

interface Release {
  id: string
  releaseNumber: string
  pallets: number
  boxes: number
  totalUnits: number
  status: string
  createdAt: string
  customerPONumber: string
  packingSlipUrl?: string | null
  boxLabelsUrl?: string | null
  documentsGenerated?: string | null
  part: {
    partNumber: string
    description: string
    unitsPerBox: number
    boxesPerPallet: number
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
          r.part.partNumber.includes(searchTerm)
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

      // Refresh releases to get updated document URLs
      await fetchReleases()
    } catch (err) {
      console.error('Error generating documents:', err)
      alert('Failed to generate documents. Please try again.')
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Release History</h1>
            <p className="text-sm text-gray-600 mt-1">View and download past packing slips</p>
          </div>
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-700">
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                Search by Release # or Part #
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="REL-20250101-0001 or 100307705"
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
                      Customer PO#
                    </th>
                    {user?.role === 'ADMIN' && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Released By
                      </th>
                    )}
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Documents
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredReleases.map((release) => (
                    <tr key={release.id} className="hover:bg-gray-50">
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {release.customerPONumber}
                      </td>
                      {user?.role === 'ADMIN' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {release.user.name}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        {release.packingSlipUrl || release.boxLabelsUrl ? (
                          <div className="flex flex-col gap-1 items-end">
                            {release.packingSlipUrl && (
                              <a
                                href={release.packingSlipUrl}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                              >
                                <FileText className="w-4 h-4" />
                                Packing Slip
                              </a>
                            )}
                            {release.boxLabelsUrl && (
                              <a
                                href={release.boxLabelsUrl}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                              >
                                <Tag className="w-4 h-4" />
                                Box Labels
                              </a>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => generateDocuments(release.id)}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                          >
                            <Package className="w-4 h-4" />
                            Generate Docs
                          </button>
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
    </div>
  )
}
