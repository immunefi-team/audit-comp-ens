export type V1Domain = {
  id: string
  labelName: string | null
  labelhash: string
  name: string
  resolver: { address: string } | null
  owner: { id: string }
  registrant: { id: string } | null
  wrappedOwner: { id: string } | null
  parent: {
    name: string
    wrappedDomain: { fuses: number } | null
  } | null
  registration: {
    expiryDate: string
  } | null
  wrappedDomain: {
    expiryDate: string
    fuses: number
  } | null
}
