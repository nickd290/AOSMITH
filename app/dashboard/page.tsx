'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react'

interface Part {
  id: string
  partNumber: string
  description: string
  unitsPerBox: number
  boxesPerPallet: number
  pricePerUnit: string
  annualOrder: number
  currentPallets: number
  currentBoxes: number
  totalBoxes: number
  totalUnits: number
  percentOfAnnual: number
  status: 'good' | 'low' | 'critical'
}

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading: authLoading, logout, token } = useAuth()
  const router = useRouter()
  const [parts, setParts] = useState<Part[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, authLoading, router])

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchParts()
    }
  }, [isAuthenticated, token])

  const fetchParts = async () => {
    try {
      const response = await fetch('/api/parts', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch parts')
      }

      const data = await response.json()
      setParts(data.parts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory')
    } finally {
      setIsLoading(false)
    }
  }

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'low':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good':
        return <CheckCircle className="w-5 h-5" />
      case 'low':
        return <AlertCircle className="w-5 h-5" />
      case 'critical':
        return <AlertTriangle className="w-5 h-5" />
      default:
        return <CheckCircle className="w-5 h-5" />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inventory Dashboard</h1>
            <p className="text-sm text-gray-600 mt-1">
              Welcome back, {user.name}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <nav className="hidden md:flex space-x-4">
              <Link
                href="/dashboard"
                className="px-4 py-2 text-blue-600 bg-blue-50 rounded-lg font-medium"
              >
                Dashboard
              </Link>
              <Link
                href="/release"
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium"
              >
                Release Inventory
              </Link>
              <Link
                href="/history"
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium"
              >
                History
              </Link>
              {user.role === 'ADMIN' && (
                <Link
                  href="/admin"
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium"
                >
                  Admin
                </Link>
              )}
            </nav>
            <button
              onClick={logout}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Quick Actions */}
        <div className="mb-8">
          <Link
            href="/release"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md"
          >
            <span className="text-xl mr-2">+</span>
            Release Inventory
          </Link>
        </div>

        {/* Inventory Cards */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">Current Inventory</h2>

          {isLoading ? (
            <div className="text-center py-12 text-gray-600">
              Loading inventory...
            </div>
          ) : parts.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow-sm">
              <p className="text-gray-600">No parts found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {parts.map((part) => (
                <div
                  key={part.id}
                  className="bg-white rounded-lg shadow-md p-6 border-2 border-gray-200 hover:shadow-lg transition-shadow"
                >
                  {/* Status Badge */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        Part #{part.partNumber}
                      </h3>
                      <p className="text-sm text-gray-600">{part.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {part.unitsPerBox} units/box • {part.boxesPerPallet} boxes/pallet
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(
                        part.status
                      )}`}
                    >
                      {getStatusIcon(part.status)} {part.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Inventory Counts */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Pallets</p>
                      <p className="text-3xl font-bold text-gray-900">{part.currentPallets}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Loose Boxes</p>
                      <p className="text-3xl font-bold text-gray-900">{part.currentBoxes}</p>
                    </div>
                  </div>

                  {/* Total Counts */}
                  <div className="border-t border-gray-200 pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Boxes:</span>
                      <span className="font-semibold text-gray-900">
                        {part.totalBoxes.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Units:</span>
                      <span className="font-semibold text-gray-900">
                        {part.totalUnits.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Annual Order:</span>
                      <span className="text-gray-600">
                        {part.annualOrder.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Stock Level:</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {part.percentOfAnnual}% of annual
                        </span>
                      </div>
                      <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            part.status === 'good'
                              ? 'bg-green-500'
                              : part.status === 'low'
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(part.percentOfAnnual, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            Standard Release: 5 Pallets (255 boxes)
          </h3>
          <p className="text-sm text-blue-800">
            Click "Release Inventory" above to start a new release order. Packing slips will be
            generated automatically for blind shipping to AO Smith locations.
          </p>
        </div>
      </main>
    </div>
  )
}
