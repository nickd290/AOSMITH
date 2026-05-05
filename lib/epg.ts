/**
 * EPG (Enterprise Print Group) constants — Apr 2026 new process.
 *
 * Per Kirk Icuss email Fri Apr 24 2026, JD Graphic now ships ALL EPG manuals to
 * EPG Knoxville (NOT direct to AOS facilities). JD ships with own paperwork on
 * XPO (JD account JDGRCCTS900, manual phone booking). EPG no longer uploads
 * packing slips.
 */

export const EPG_SHIP_TO = {
  name: 'Enterprise Print Group',
  address: '6234 Enterprise Drive',
  city: 'Knoxville',
  state: 'TN',
  zip: '37909',
  country: 'USA',
  phone: '865-219-5587',
  website: 'www.eprintgroup.com',
  // Mailing address (PO Box) — distinct from the visit/freight address.
  // Reference only; freight paperwork uses the visit address above.
  mailingAddress: {
    poBox: 'PO Box 52870',
    city: 'Knoxville',
    state: 'TN',
    zip: '37950',
  },
} as const

export const JD_SHIP_FROM = {
  name: 'JD Graphic, Co Inc',
  address: '1101 Arthur Ave',
  city: 'Elk Grove Village',
  state: 'IL',
  zip: '60007',
  country: 'USA',
  phone: '847-364-4000',
  email: 'Nick@JDGraphic.com',
} as const

export const EPG_DEFAULT_CARRIER = 'XPO'
export const EPG_DEFAULT_CARRIER_ACCOUNT = 'JDGRCCTS900'
export const EPG_DEFAULT_FREIGHT_TERMS = 'Prepaid'

/** Fallback weight when release.weight is 0/null. EPG manual pallet ≈ 1000 lbs. */
export const EPG_DEFAULT_LBS_PER_PALLET = 1000

export const EPG_LOCATION_NAME = EPG_SHIP_TO.name
