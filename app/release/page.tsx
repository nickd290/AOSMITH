'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, FileText, Tag, Package } from 'lucide-react'

interface Part {
  id: string
  partNumber: string
  description: string
  unitsPerBox: number
  boxesPerPallet: number
  currentPallets: number
  currentBoxes: number
}

interface ShippingLocation {
  id: string
  name: string
  address: string
  city: string
  state: string
  zip: string
}

interface Release {
  id: string
  releaseNumber: string
  partId: string
  shippingLocationId: string
  pallets: number
  boxes: number
  totalUnits: number
  part: Part
  shippingLocation: ShippingLocation
}

export default function ReleasePage() {
  const { user, isAuthenticated, isLoading: authLoading, token } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [parts, setParts] = useState<Part[]>([])
  const [locations, setLocations] = useState<ShippingLocation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  // Form data
  const [selectedPartId, setSelectedPartId] = useState('')
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [pallets, setPallets] = useState(5)
  const [notes, setNotes] = useState('')
  const [customerPONumber, setCustomerPONumber] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const [shipVia, setShipVia] = useState('Averitt Collect')
  const [freightTerms, setFreightTerms] = useState('Prepaid')
  const [manufactureDate, setManufactureDate] = useState(new Date().toISOString().split('T')[0])

  // Release result
  const [release, setRelease] = useState<Release | null>(null)

  // Document generation state
  const [isGeneratingDocs, setIsGeneratingDocs] = useState(false)
  const [packingSlipUrl, setPackingSlipUrl] = useState<string | null>(null)
  const [boxLabelsUrl, setBoxLabelsUrl] = useState<string | null>(null)
  const [docError, setDocError] = useState('')

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, authLoading, router])

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchData()
    }
  }, [isAuthenticated, token])

  const fetchData = async () => {
    try {
      const [partsRes, locationsRes] = await Promise.all([
        fetch('/api/parts', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/shipping-locations', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      const partsData = await partsRes.json()
      const locationsData = await locationsRes.json()

      setParts(partsData.parts)
      setLocations(locationsData.locations)
    } catch (err) {
      setError('Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/releases', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partId: selectedPartId,
          shippingLocationId: selectedLocationId,
          pallets,
          boxes: 0,
          notes,
          customerPONumber,
          batchNumber,
          shipVia,
          freightTerms,
          manufactureDate,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create release')
      }

      const data = await response.json()
      setRelease(data.release)
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create release')
    } finally {
      setIsLoading(false)
    }
  }

  const generateDocuments = async (documentType: 'packing-slip' | 'box-labels' | 'all') => {
    if (!release) return

    setIsGeneratingDocs(true)
    setDocError('')

    try {
      const response = await fetch(`/api/releases/${release.id}/documents`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentType }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate documents')
      }

      const data = await response.json()

      if (data.packingSlipUrl) {
        setPackingSlipUrl(data.packingSlipUrl)
      }
      if (data.boxLabelsUrl) {
        setBoxLabelsUrl(data.boxLabelsUrl)
      }
    } catch (err) {
      setDocError(err instanceof Error ? err.message : 'Failed to generate documents')
    } finally {
      setIsGeneratingDocs(false)
    }
  }

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  const selectedPart = parts.find((p) => p.id === selectedPartId)
  const selectedLocation = locations.find((l) => l.id === selectedLocationId)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Release Inventory</h1>
          </div>
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-700">
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center">
            <div className={`flex items-center ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200'
                }`}
              >
                1
              </div>
              <span className="ml-2 font-medium hidden sm:inline">Select Part</span>
            </div>
            <div className={`h-1 w-16 mx-4 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
            <div className={`flex items-center ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200'
                }`}
              >
                2
              </div>
              <span className="ml-2 font-medium hidden sm:inline">Confirm Details</span>
            </div>
            <div className={`h-1 w-16 mx-4 ${step >= 3 ? 'bg-blue-600' : 'bg-gray-200'}`} />
            <div className={`flex items-center ${step >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200'
                }`}
              >
                3
              </div>
              <span className="ml-2 font-medium hidden sm:inline">Generate Slip</span>
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-md p-8">
          {/* Step 1: Select Part */}
          {step === 1 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Select Part Number</h2>
              {isLoading ? (
                <div className="text-center py-8 text-gray-600">Loading parts...</div>
              ) : (
                <div className="space-y-4">
                  {parts.map((part) => (
                    <div
                      key={part.id}
                      onClick={() => setSelectedPartId(part.id)}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedPartId === part.id
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            Part #{part.partNumber}
                          </h3>
                          <p className="text-sm text-gray-600">{part.description}</p>
                          <p className="text-sm text-gray-500 mt-1">
                            {part.unitsPerBox} units/box • {part.boxesPerPallet} boxes/pallet
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Available:</p>
                          <p className="text-xl font-bold text-gray-900">{part.currentPallets}</p>
                          <p className="text-sm text-gray-600">pallets</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setStep(2)}
                  disabled={!selectedPartId}
                  className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Confirm Details */}
          {step === 2 && selectedPart && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Confirm Release Details</h2>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h3 className="font-semibold text-gray-900 mb-2">Selected Part:</h3>
                <p className="text-gray-700">
                  Part #{selectedPart.partNumber} - {selectedPart.description}
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Pallets
                </label>
                <input
                  type="number"
                  value={pallets}
                  onChange={(e) => setPallets(parseInt(e.target.value) || 5)}
                  min={1}
                  max={selectedPart.currentPallets}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
                <p className="text-sm text-gray-500 mt-1">
                  = {pallets * selectedPart.boxesPerPallet} boxes = {' '}
                  {(pallets * selectedPart.boxesPerPallet * selectedPart.unitsPerBox).toLocaleString()}{' '}
                  units
                </p>
                <p className="text-sm font-medium text-gray-700 mt-2">
                  Total Cartons: {pallets * selectedPart.boxesPerPallet}
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Shipping Location
                </label>
                <select
                  value={selectedLocationId}
                  onChange={(e) => setSelectedLocationId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select a location...</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name} - {location.city}, {location.state}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer PO# <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={customerPONumber}
                  onChange={(e) => setCustomerPONumber(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., 4502654775"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Batch # (Optional)
                  </label>
                  <input
                    type="text"
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="Auto-generated if blank"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Manufacture Date
                  </label>
                  <input
                    type="date"
                    value={manufactureDate}
                    onChange={(e) => setManufactureDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ship Via
                  </label>
                  <select
                    value={shipVia}
                    onChange={(e) => setShipVia(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="Averitt Collect">Averitt Collect</option>
                    <option value="UPS">UPS</option>
                    <option value="FedEx">FedEx</option>
                    <option value="Customer Pickup">Customer Pickup</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Freight Terms
                  </label>
                  <select
                    value={freightTerms}
                    onChange={(e) => setFreightTerms(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="Prepaid">Prepaid</option>
                    <option value="Collect">Collect</option>
                    <option value="Third Party">Third Party</option>
                  </select>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="Add any special instructions..."
                />
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  ← Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!selectedLocationId || !customerPONumber || isLoading}
                  className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Creating...' : 'Create Release →'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Generate Documents */}
          {step === 3 && release && (
            <div className="text-center">
              <div className="mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Release Created!</h2>
                <p className="text-gray-600">Release #{release.releaseNumber}</p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg mb-6 text-left">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Part:</span>
                    <span className="font-semibold">
                      #{release.part.partNumber} - {release.part.description}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Quantity:</span>
                    <span className="font-semibold">
                      {release.pallets} pallets ({release.pallets * release.part.boxesPerPallet}{' '}
                      boxes)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Units:</span>
                    <span className="font-semibold">{release.totalUnits.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ship To:</span>
                    <span className="font-semibold">{release.shippingLocation.name}</span>
                  </div>
                </div>
              </div>

              {/* Document Generation Section */}
              <div className="mb-6 p-6 bg-blue-50 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate Documents</h3>

                {docError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
                    {docError}
                  </div>
                )}

                {/* Document Generation Buttons */}
                {!packingSlipUrl && !boxLabelsUrl && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    <button
                      onClick={() => generateDocuments('packing-slip')}
                      disabled={isGeneratingDocs}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-blue-600 text-blue-600 font-semibold rounded-lg hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FileText className="w-5 h-5" />
                      Packing Slip
                    </button>
                    <button
                      onClick={() => generateDocuments('box-labels')}
                      disabled={isGeneratingDocs}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-blue-600 text-blue-600 font-semibold rounded-lg hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Tag className="w-5 h-5" />
                      Box Labels
                    </button>
                    <button
                      onClick={() => generateDocuments('all')}
                      disabled={isGeneratingDocs}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Package className="w-5 h-5" />
                      All Documents
                    </button>
                  </div>
                )}

                {isGeneratingDocs && (
                  <div className="py-4 text-blue-600">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-sm">Generating documents...</p>
                  </div>
                )}

                {/* Download Links */}
                {(packingSlipUrl || boxLabelsUrl) && (
                  <div className="space-y-3">
                    {packingSlipUrl && (
                      <a
                        href={packingSlipUrl}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between px-4 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        <span className="flex items-center text-gray-900">
                          <FileText className="w-6 h-6 text-blue-600 mr-3" />
                          <span className="font-medium">Packing Slip</span>
                        </span>
                        <span className="text-blue-600 text-sm">Download PDF →</span>
                      </a>
                    )}
                    {boxLabelsUrl && (
                      <a
                        href={boxLabelsUrl}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between px-4 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        <span className="flex items-center text-gray-900">
                          <Tag className="w-6 h-6 text-blue-600 mr-3" />
                          <span className="font-medium">Box Labels ({release.pallets * release.part.boxesPerPallet} labels)</span>
                        </span>
                        <span className="text-blue-600 text-sm">Download PDF →</span>
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Link
                  href="/dashboard"
                  className="block px-6 py-3 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
                >
                  Return to Dashboard
                </Link>
                <Link
                  href="/history"
                  className="block px-6 py-3 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  View Release History
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
