import { describe, expect, it } from 'vitest'
import { getEventFieldType, getEventSignature } from './eventSignatures'

describe('getEventSignature', () => {
  it('should return correct signatures for all event types', () => {
    const signatures = {
      // Domain Events
      Transfer: getEventSignature('Transfer'),
      NewOwner: getEventSignature('NewOwner'),
      NewResolver: getEventSignature('NewResolver'),
      NewTTL: getEventSignature('NewTTL'),
      NameWrapped: getEventSignature('NameWrapped'),
      NameUnwrapped: getEventSignature('NameUnwrapped'),
      FusesSet: getEventSignature('FusesSet'),
      ExpiryExtended: getEventSignature('ExpiryExtended'),

      // Registration Events
      NameRegistered: getEventSignature('NameRegistered'),
      NameRenewed: getEventSignature('NameRenewed'),
      NameTransferred: getEventSignature('NameTransferred'),

      // Resolver Events
      AddrChanged: getEventSignature('AddrChanged'),
      MulticoinAddrChanged: getEventSignature('MulticoinAddrChanged'),
      TextChanged: getEventSignature('TextChanged'),
      ContenthashChanged: getEventSignature('ContenthashChanged'),
      NameChanged: getEventSignature('NameChanged'),
      AbiChanged: getEventSignature('AbiChanged'),
      PubkeyChanged: getEventSignature('PubkeyChanged'),
      InterfaceChanged: getEventSignature('InterfaceChanged'),
      VersionChanged: getEventSignature('VersionChanged'),
      AuthorisationChanged: getEventSignature('AuthorisationChanged'),
    }

    expect(signatures).toMatchInlineSnapshot(`
      {
        "AbiChanged": "ABIChanged (bytes32 indexed node, uint256 indexed contentType)",
        "AddrChanged": "AddrChanged (bytes32 indexed node, address a)",
        "AuthorisationChanged": "AuthorisationChanged (bytes32 indexed node, address indexed owner, address indexed target, bool isAuthorised)",
        "ContenthashChanged": "ContenthashChanged (bytes32 indexed node, bytes hash)",
        "ExpiryExtended": "ExpiryExtended (bytes32 indexed node, uint64 expiry)",
        "FusesSet": "FusesSet (bytes32 indexed node, uint32 fuses)",
        "InterfaceChanged": "InterfaceChanged (bytes32 indexed node, bytes4 indexed interfaceID, address implementer)",
        "MulticoinAddrChanged": "AddressChanged (bytes32 indexed node, uint256 coinType, bytes newAddress)",
        "NameChanged": "NameChanged (bytes32 indexed node, string name)",
        "NameRegistered": "NameRegistered (string name, bytes32 indexed label, address indexed owner, uint256 cost, uint256 expires)",
        "NameRenewed": "NameRenewed (string name, bytes32 indexed label, uint256 cost, uint256 expires)",
        "NameTransferred": "NameTransferred (string name, bytes32 indexed label, address indexed newOwner)",
        "NameUnwrapped": "NameUnwrapped (bytes32 indexed node, address owner)",
        "NameWrapped": "NameWrapped (bytes32 indexed node, bytes name, address owner, uint32 fuses, uint64 expiry)",
        "NewOwner": "NewOwner (bytes32 indexed node, bytes32 indexed label, address owner)",
        "NewResolver": "NewResolver (bytes32 indexed node, address resolver)",
        "NewTTL": "NewTTL (bytes32 indexed node, uint64 ttl)",
        "PubkeyChanged": "PubkeyChanged (bytes32 indexed node, bytes32 x, bytes32 y)",
        "TextChanged": "TextChanged (bytes32 indexed node, string indexed indexedKey, string key, string value)",
        "Transfer": "Transfer (bytes32 indexed node, address owner)",
        "VersionChanged": "VersionChanged (bytes32 indexed node, uint64 newVersion)",
      }
    `)
  })

  it('should return input for unknown event types', () => {
    expect(getEventSignature('UnknownEvent')).toBe('UnknownEvent')
    expect(getEventSignature('')).toBe('')
  })

  it('should return signatures for resolver indexer event types', () => {
    expect(getEventSignature('EACRolesChanged')).toBe(
      'EACRolesChanged (uint256 resource, address account, uint256 oldRoleBitmap, uint256 newRoleBitmap)',
    )
    expect(getEventSignature('AddressChanged')).toBe(
      'AddressChanged (bytes32 indexed node, uint256 coinType, bytes newAddress)',
    )
    expect(getEventSignature('AliasChanged')).toBe(
      'AliasChanged (bytes32 indexed node, bytes alias)',
    )
    expect(getEventSignature('ABIChanged')).toBe(
      'ABIChanged (bytes32 indexed node, uint256 indexed contentType)',
    )
    expect(getEventSignature('ResolverUpdated')).toBe(
      'ResolverUpdated (uint256 tokenId, address resolver)',
    )
  })
})

describe('getEventFieldType', () => {
  it('should return correct field types', () => {
    expect(getEventFieldType('Transfer', 'owner')).toBe('address')
    expect(getEventFieldType('NameWrapped', 'fuses')).toBe('uint32')
    expect(getEventFieldType('TextChanged', 'value')).toBe('string')
  })

  it('should return unknown for non-existent fields or events', () => {
    expect(getEventFieldType('Transfer', 'nonexistent')).toBe('unknown')
    expect(getEventFieldType('UnknownEvent', 'anyField')).toBe('unknown')
  })

  it('should return correct field types for resolver indexer events', () => {
    expect(getEventFieldType('EACRolesChanged', 'account')).toBe('address')
    expect(getEventFieldType('EACRolesChanged', 'resource')).toBe('uint256')
    expect(getEventFieldType('EACRolesChanged', 'oldRoleBitmap')).toBe(
      'uint256',
    )
    expect(getEventFieldType('EACRolesChanged', 'newRoleBitmap')).toBe(
      'uint256',
    )
    expect(getEventFieldType('AddressChanged', 'coinType')).toBe('uint256')
    expect(getEventFieldType('AddressChanged', 'address')).toBe('bytes')
    expect(getEventFieldType('AliasChanged', 'alias')).toBe('bytes')
    expect(getEventFieldType('ResolverUpdated', 'resolver')).toBe('address')
  })

  it('should return unknown for non-existent fields on resolver indexer events', () => {
    expect(getEventFieldType('EACRolesChanged', 'nonexistent')).toBe('unknown')
    expect(getEventFieldType('AddressChanged', 'nonexistent')).toBe('unknown')
  })
})
