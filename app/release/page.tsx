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

  // Default ship date = next business day (skip Sat/Sun).
  // Per Apr 2026 EPG new process, releases ship out the day after they're created.
  const nextBusinessDayISO = (): string => {
    const d = new Date()
    do {
      d.setDate(d.getDate() + 1)
    } while (d.getDay() === 0 || d.getDay() === 6)
    return d.toISOString().split('T')[0]
  }

  // Form data
  const [selectedPartId, setSelectedPartId] = useState('')
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [pallets, setPallets] = useState(5)
  const [notes, setNotes] = useState('')
  const [customerPONumber, setCustomerPONumber] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const [shipVia, setShipVia] = useState('XPO')
  const [freightTerms, setFreightTerms] = useState('Prepaid')
  const [shipDate, setShipDate] = useState(nextBusinessDayISO())
  const [skidType, setSkidType] = useState<'' | 'WOOD' | 'HEAT_TREATED'>('')

  // Calculate ETA delivery date (5 business days from ship date)
  const calculateETA = (shipDateStr: string): string => {
    const date = new Date(shipDateStr)
    let daysToAdd = 5
    while (daysToAdd > 0) {
      date.setDate(date.getDate() + 1)
      // Skip weekends
      if (date.getDay() !== 0 && date.getDay() !== 6) {
        daysToAdd--
      }
    }
    return date.toISOString().split('T')[0]
  }

  const etaDeliveryDate = calculateETA(shipDate)

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
      // Apr 2026 EPG new process — single locked ship-to. Auto-pick the lone
      // active location so the user never has to choose.
      if (locationsData.locations?.length > 0) {
        setSelectedLocationId(locationsData.locations[0].id)
      }
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
          shipDate,
          etaDeliveryDate,
          skidType,
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
      <div className="flex min-h-screen items-center justify-center bg-brand-cream">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  const selectedPart = parts.find((p) => p.id === selectedPartId)
  const selectedLocation = locations.find((l) => l.id === selectedLocationId)

  return (
    <div className="min-h-screen bg-brand-cream">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-brand-rule">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-brand-ink">Release Inventory</h1>
          </div>
          <Link href="/dashboard" className="text-brand-rust hover:text-brand-rust-dark">
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
            <div className={`flex items-center ${step >= 1 ? 'text-brand-rust' : 'text-gray-400'}`}>
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  step >= 1 ? 'bg-brand-rust text-white' : 'bg-gray-200'
                }`}
              >
                1
              </div>
              <span className="ml-2 font-medium hidden sm:inline">Select Part</span>
            </div>
            <div className={`h-1 w-16 mx-4 ${step >= 2 ? 'bg-brand-rust' : 'bg-gray-200'}`} />
            <div className={`flex items-center ${step >= 2 ? 'text-brand-rust' : 'text-gray-400'}`}>
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  step >= 2 ? 'bg-brand-rust text-white' : 'bg-gray-200'
                }`}
              >
                2
              </div>
              <span className="ml-2 font-medium hidden sm:inline">Confirm Details</span>
            </div>
            <div className={`h-1 w-16 mx-4 ${step >= 3 ? 'bg-brand-rust' : 'bg-gray-200'}`} />
            <div className={`flex items-center ${step >= 3 ? 'text-brand-rust' : 'text-gray-400'}`}>
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  step >= 3 ? 'bg-brand-rust text-white' : 'bg-gray-200'
                }`}
              >
                3
              </div>
              <span className="ml-2 font-medium hidden sm:inline">Generate Slip</span>
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-sm p-8">
          {/* Step 1: Select Part */}
          {step === 1 && (
            <div>
              <h2 className="text-2xl font-bold text-brand-ink mb-6">Select Part Number</h2>
              {isLoading ? (
                <div className="text-center py-8 text-brand-ink-mute">Loading parts...</div>
              ) : (
                <div className="space-y-4">
                  {parts.map((part) => (
                    <div
                      key={part.id}
                      onClick={() => setSelectedPartId(part.id)}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedPartId === part.id
                          ? 'border-brand-rust bg-brand-rust-soft'
                          : 'border-brand-rule hover:border-brand-rust'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-semibold text-brand-ink">
                            Part #{part.partNumber}
                          </h3>
                          <p className="text-sm text-brand-ink-mute">{part.description}</p>
                          <p className="text-sm text-brand-ink-mute mt-1">
                            {part.unitsPerBox} units/box • {part.boxesPerPallet} boxes/pallet
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-brand-ink-mute">Available:</p>
                          <p className="text-xl font-bold text-brand-ink">{part.currentPallets}</p>
                          <p className="text-sm text-brand-ink-mute">pallets</p>
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
                  className="px-6 py-3 bg-brand-rust text-white font-semibold rounded-lg hover:bg-brand-rust-dark disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Confirm Details */}
          {step === 2 && selectedPart && (
            <div>
              <h2 className="text-2xl font-bold text-brand-ink mb-6">Confirm Release Details</h2>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h3 className="font-semibold text-brand-ink mb-2">Selected Part:</h3>
                <p className="text-brand-ink-soft">
                  Part #{selectedPart.partNumber} - {selectedPart.description}
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-brand-ink-soft mb-2">
                  Number of Pallets
                </label>
                <input
                  type="number"
                  value={pallets}
                  onChange={(e) => setPallets(parseInt(e.target.value) || 5)}
                  min={1}
                  max={selectedPart.currentPallets}
                  className="w-full px-4 py-2 border border-brand-rule rounded-lg"
                />
                <p className="text-sm text-brand-ink-mute mt-1">
                  = {pallets * selectedPart.boxesPerPallet} boxes = {' '}
                  {(pallets * selectedPart.boxesPerPallet * selectedPart.unitsPerBox).toLocaleString()}{' '}
                  units
                </p>
                <p className="text-sm font-medium text-brand-ink-soft mt-2">
                  Total Cartons: {pallets * selectedPart.boxesPerPallet}
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-brand-ink-soft mb-2">
                  Shipping To
                </label>
                <div className="px-4 py-3 bg-brand-cream-deep border border-brand-rule rounded-lg">
                  {selectedLocation ? (
                    <>
                      <div className="font-semibold text-brand-ink">{selectedLocation.name}</div>
                      <div className="text-sm text-brand-ink-soft">{selectedLocation.address}</div>
                      <div className="text-sm text-brand-ink-soft">
                        {selectedLocation.city}, {selectedLocation.state} {selectedLocation.zip}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-brand-ink-mute">Loading shipping address…</div>
                  )}
                  <div className="text-xs text-brand-ink-mute mt-2">
                    All releases ship to this location only.
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-brand-ink-soft mb-2">
                  Customer PO# <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={customerPONumber}
                  onChange={(e) => setCustomerPONumber(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-brand-rule rounded-lg"
                  placeholder="e.g., 4502654775"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-brand-ink-soft mb-2">
                    Batch # (Optional)
                  </label>
                  <input
                    type="text"
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    className="w-full px-4 py-2 border border-brand-rule rounded-lg"
                    placeholder="Auto-generated if blank"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-brand-ink-soft mb-2">
                    Ship Date
                  </label>
                  <input
                    type="date"
                    value={shipDate}
                    onChange={(e) => setShipDate(e.target.value)}
                    className="w-full px-4 py-2 border border-brand-rule rounded-lg"
                  />
                </div>
              </div>

              {/* ETA Delivery Date - Always shown based on Ship Date */}
              <div className="mb-6 p-4 bg-brand-rust-soft border border-brand-rust-soft rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-sm font-medium text-brand-ink-soft">ETA Delivery Date:</span>
                    <p className="text-lg font-semibold text-brand-rust-dark">
                      {new Date(etaDeliveryDate + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  <div className="text-right text-sm text-brand-ink-mute">
                    <p>5 business days from pickup</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-brand-ink-soft mb-2">
                    Ship Via
                  </label>
                  <select
                    value={shipVia}
                    onChange={(e) => setShipVia(e.target.value)}
                    className="w-full px-4 py-2 border border-brand-rule rounded-lg"
                  >
                    <option value="XPO">XPO</option>
                    <option value="FedEx Freight">FedEx Freight</option>
                    <option value="Averitt Collect">Averitt Collect</option>
                    <option value="UPS">UPS</option>
                    <option value="Customer Pickup">Customer Pickup</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-brand-ink-soft mb-2">
                    Freight Terms
                  </label>
                  <select
                    value={freightTerms}
                    onChange={(e) => setFreightTerms(e.target.value)}
                    className="w-full px-4 py-2 border border-brand-rule rounded-lg"
                  >
                    <option value="Prepaid">Prepaid</option>
                    <option value="Collect">Collect</option>
                    <option value="Third Party">Third Party</option>
                  </select>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-brand-ink-soft mb-2">
                  Skid Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([
                    { value: 'WOOD', label: 'Wood Skid', sub: 'Standard domestic pallet' },
                    { value: 'HEAT_TREATED', label: 'Heat-Treated Skid', sub: 'ISPM-15 compliant (HT stamp)' },
                  ] as const).map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        skidType === opt.value
                          ? 'border-brand-rust bg-brand-rust-soft'
                          : 'border-brand-rule hover:border-brand-rust'
                      }`}
                    >
                      <input
                        type="radio"
                        name="skidType"
                        value={opt.value}
                        checked={skidType === opt.value}
                        onChange={() => setSkidType(opt.value)}
                        className="mt-1 accent-brand-rust"
                      />
                      <div>
                        <div className="font-semibold text-brand-ink">{opt.label}</div>
                        <div className="text-xs text-brand-ink-mute">{opt.sub}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-brand-ink-soft mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-brand-rule rounded-lg"
                  placeholder="Add any special instructions..."
                />
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 text-brand-ink-soft border border-brand-rule rounded-lg hover:bg-brand-cream-deep"
                >
                  ← Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!selectedLocationId || !customerPONumber || !skidType || isLoading}
                  className="px-6 py-3 bg-brand-rust text-white font-semibold rounded-lg hover:bg-brand-rust-dark disabled:opacity-50 disabled:cursor-not-allowed"
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
                <h2 className="text-2xl font-bold text-brand-ink mb-2">Release Created!</h2>
                <p className="text-brand-ink-mute">Release #{release.releaseNumber}</p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg mb-6 text-left">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-brand-ink-mute">Part:</span>
                    <span className="font-semibold">
                      #{release.part.partNumber} - {release.part.description}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-brand-ink-mute">Quantity:</span>
                    <span className="font-semibold">
                      {release.pallets} pallets ({release.pallets * release.part.boxesPerPallet}{' '}
                      boxes)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-brand-ink-mute">Total Units:</span>
                    <span className="font-semibold">{release.totalUnits.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-brand-ink-mute">Ship To:</span>
                    <span className="font-semibold">{release.shippingLocation.name}</span>
                  </div>
                </div>
              </div>

              {/* Document Generation Section */}
              <div className="mb-6 p-6 bg-brand-rust-soft rounded-lg">
                <h3 className="text-lg font-semibold text-brand-ink mb-4">Generate Documents</h3>

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
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-brand-rust text-brand-rust font-semibold rounded-lg hover:bg-brand-rust-soft disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FileText className="w-5 h-5" />
                      Packing Slip
                    </button>
                    <button
                      onClick={() => generateDocuments('box-labels')}
                      disabled={isGeneratingDocs}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-brand-rust text-brand-rust font-semibold rounded-lg hover:bg-brand-rust-soft disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Tag className="w-5 h-5" />
                      Box Labels
                    </button>
                    <button
                      onClick={() => generateDocuments('all')}
                      disabled={isGeneratingDocs}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-brand-rust text-white font-semibold rounded-lg hover:bg-brand-rust-dark disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Package className="w-5 h-5" />
                      All Documents
                    </button>
                  </div>
                )}

                {isGeneratingDocs && (
                  <div className="py-4 text-brand-rust">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-rust mx-auto mb-2"></div>
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
                        className="flex items-center justify-between px-4 py-3 bg-white border border-brand-rule rounded-lg hover:bg-brand-cream-deep"
                      >
                        <span className="flex items-center text-brand-ink">
                          <FileText className="w-6 h-6 text-brand-rust mr-3" />
                          <span className="font-medium">Packing Slip</span>
                        </span>
                        <span className="text-brand-rust text-sm">Download PDF →</span>
                      </a>
                    )}
                    {boxLabelsUrl && (
                      <a
                        href={boxLabelsUrl}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between px-4 py-3 bg-white border border-brand-rule rounded-lg hover:bg-brand-cream-deep"
                      >
                        <span className="flex items-center text-brand-ink">
                          <Tag className="w-6 h-6 text-brand-rust mr-3" />
                          <span className="font-medium">Box Labels ({release.pallets * release.part.boxesPerPallet} labels)</span>
                        </span>
                        <span className="text-brand-rust text-sm">Download PDF →</span>
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Link
                  href="/dashboard"
                  className="block px-6 py-3 text-brand-rust border border-brand-rust rounded-lg hover:bg-brand-rust-soft"
                >
                  Return to Dashboard
                </Link>
                <Link
                  href="/history"
                  className="block px-6 py-3 text-brand-ink-soft border border-brand-rule rounded-lg hover:bg-brand-cream-deep"
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
