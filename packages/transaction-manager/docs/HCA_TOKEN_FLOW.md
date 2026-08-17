# HCA Token Approval Flow

## The HCA (Hosted Chain Abstraction) Design

The goal of HCA is:
1. **EOA (your regular wallet)** owns the ENS name and holds the tokens
2. **Smart Account** executes transactions on your behalf (gas is sponsored, so EOA pays nothing)
3. The ENS name is registered to the EOA, not the smart account

## How HCAEquivalence Works

When contracts use HCAEquivalence, they can identify the EOA owner behind a smart account. This is done by overriding `_msgSender()`:

```solidity
// In HCAEquivalence.sol
function _msgSenderWithHcaEquivalence() internal view returns (address) {
    // Ask the HCA Factory: "Who owns this smart account?"
    address accountOwner = HCA_FACTORY.getAccountOwner(msg.sender);

    // If the smart account has a registered owner, return that owner (the EOA)
    if (accountOwner != address(0)) return accountOwner;

    // Otherwise, return the actual caller
    return msg.sender;
}
```

So when your **smart account** calls any HCA-aware contract:
- `msg.sender` = smart account address
- `_msgSender()` = **EOA address** (because the smart account is registered in HCA Factory)

## The Complete Flow

### Step 1: Token Approval (Gas-Sponsored)

The token contract must use HCAEquivalence so that approvals work correctly:

```
Smart Account calls: token.approve(registrar, amount)
                            ↓
Token contract sees: _msgSender() = EOA  (via HCAEquivalence)
                            ↓
Approval recorded as: EOA → Registrar ✓
```

### Step 2: Registration (Gas-Sponsored)

The registrar also uses HCAEquivalence:

```
Smart Account calls: registrar.register(name, duration, ...)
                            ↓
Registrar sees: _msgSender() = EOA  (via HCAEquivalence)
                            ↓
Registrar does: token.transferFrom(EOA, beneficiary, cost)
                            ↓
Token checks: allowance[EOA][registrar] ≥ cost  ✓
                            ↓
Transfer succeeds, name registered to EOA ✓
```

## Visual Summary

```
FULLY GAS-SPONSORED HCA FLOW:

┌─────────────────┐                    ┌───────────────────────┐
│  Smart Account  │ ── approve() ───>  │ Token + HCAEquivalence │
│  (pays gas)     │                    │ _msgSender() = EOA     │
└─────────────────┘                    └───────────────────────┘
        │                                        │
        │                              Records: EOA → Registrar ✓
        │
        │ register()
        ▼
┌───────────────────────────┐          ┌─────────┐
│ Registrar + HCAEquivalence │ ──────> │  Token  │
│ _msgSender() = EOA         │         └─────────┘
└───────────────────────────┘                │
                                             │
                              transferFrom(EOA, beneficiary, cost)
                                             │
                                             ▼
                                    Allowance check passes ✓
                                    Name registered to EOA ✓
```

## Why Both Contracts Need HCAEquivalence

| Contract | Without HCAEquivalence | With HCAEquivalence |
|----------|----------------------|---------------------|
| **Token** | `approve()` records SmartAccount → Registrar | `approve()` records EOA → Registrar ✓ |
| **Registrar** | `transferFrom(SmartAccount, ...)` - wrong source | `transferFrom(EOA, ...)` - correct ✓ |

Both must use HCAEquivalence for the flow to work correctly.

## Common Mistake: Token Without HCAEquivalence

If the token doesn't use HCAEquivalence:

```
Smart Account calls: token.approve(registrar, amount)
                            ↓
Token sees: _msgSender() = SmartAccount  (no HCAEquivalence!)
                            ↓
Approval recorded as: SmartAccount → Registrar  ✗ WRONG!
                            ↓
Later, registrar tries: transferFrom(EOA, beneficiary, cost)
                            ↓
Token checks: allowance[EOA][registrar] = 0  ✗
                            ↓
ERROR: ERC20InsufficientAllowance
```

## Required Contract Setup

For HCA registration to work, both contracts must extend HCAEquivalence:

### Token Contract (e.g., MockERC20)
```solidity
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {HCAEquivalence} from "./common/hca/HCAEquivalence.sol";

contract MockERC20 is ERC20, HCAEquivalence {
    constructor(string memory symbol, uint8 decimals_, address hcaFactory)
        ERC20(symbol, symbol)
        HCAEquivalence(hcaFactory)
    { }

    function _msgSender() internal view override returns (address) {
        return _msgSenderWithHcaEquivalence();
    }
}
```

### Registrar Contract
Already implemented - ETHRegistrar extends HCAContext which uses HCAEquivalence.

## Related Contracts

- `namechain/contracts/src/L2/registrar/ETHRegistrar.sol` - The registrar contract
- `namechain/contracts/src/common/hca/HCAContext.sol` - Base class with `_msgSender()` override
- `namechain/contracts/src/common/hca/HCAEquivalence.sol` - The `_msgSenderWithHcaEquivalence()` implementation
- `namechain/contracts/src/common/hca/interfaces/IHCAFactoryBasic.sol` - HCA Factory interface
- `namechain/contracts/test/mocks/MockERC20.sol` - Mock token (needs HCAEquivalence)
