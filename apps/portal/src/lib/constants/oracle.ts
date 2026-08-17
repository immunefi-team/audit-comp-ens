/**
 * Decimal precision the StandardRentPriceOracle uses internally for all price
 * values (base rates, premium price).
 *
 * `formatUnits(rawValue, ORACLE_PRICE_DECIMALS)` converts oracle-native units
 * into USD (since the oracle is denominated in USD-per-second).
 */
export const ORACLE_PRICE_DECIMALS = 12
