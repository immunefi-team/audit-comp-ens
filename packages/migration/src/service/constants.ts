// V1 NameWrapper grace period (90 days), in seconds.
//
// A wrapped `.eth` 2LD stores its wrapper expiry as `registrarExpiry + GRACE_PERIOD`,
// so `getData`/`ownerOf`/`balanceOf` still report it as owned during the grace period.
// But `NameWrapper._beforeTransfer` strips this grace back off before checking
// transferability, so an `IS_DOT_ETH` name in grace is owned-but-not-transferable and any
// migration transfer reverts with "ERC1155: insufficient balance for transfer". Subtract
// this from the wrapper expiry to recover the underlying registration expiry.
export const GRACE_PERIOD_SECONDS = 90n * 24n * 60n * 60n
