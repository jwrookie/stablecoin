// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";

library PoolLibrary {
    using SafeMath for uint256;

    uint256 public constant PRICE_PRECISION = 1e6;

    struct MintFFParams {
        uint256 stockPrice;
        uint256 colPriceUsd;
        uint256 stockAmount;
        uint256 collateralAmount;
        uint256 colRatio;
    }

    struct BuybackStockParams {
        uint256 excess_collateral_dollar_value_d18;
        uint256 stockPrice;
        uint256 colPriceUsd;
        uint256 stockAmount;
    }

    function calcMint1t1Stable(uint256 col_price, uint256 collateral_amount_d18) public pure returns (uint256) {
        return (collateral_amount_d18.mul(col_price)).div(1e6);
    }

    function calcMintAlgorithmicStable(uint256 stockPrice, uint256 _amount) public pure returns (uint256) {
        return _amount.mul(stockPrice).div(1e6);
    }

    function calcMintFractionalStable(MintFFParams memory params) internal pure returns (uint256, uint256) {
        uint256 stock_dollar_value_d18;
        uint256 c_dollar_value_d18;

        // Scoping for stack concerns
        {
            stock_dollar_value_d18 = params.stockAmount.mul(params.stockPrice).div(1e6);
            c_dollar_value_d18 = params.collateralAmount.mul(params.colPriceUsd).div(1e6);
        }
        uint256 calculated_fxs_dollar_value_d18 = (c_dollar_value_d18.mul(1e6).div(params.colRatio)).sub(
            c_dollar_value_d18
        );

        uint256 calculated_fxs_needed = calculated_fxs_dollar_value_d18.mul(1e6).div(params.stockPrice);

        return (c_dollar_value_d18.add(calculated_fxs_dollar_value_d18), calculated_fxs_needed);
    }

    function calcRedeem1t1Stable(uint256 colPriceUsd, uint256 _amount) public pure returns (uint256) {
        return _amount.mul(1e6).div(colPriceUsd);
    }

    // Must be internal because of the struct
    function calcBuyBackStock(BuybackStockParams memory params) internal pure returns (uint256) {
        // If the total collateral value is higher than the amount required at the current collateral ratio then buy back up to the possible FXS with the desired collateral
        require(params.excess_collateral_dollar_value_d18 > 0, "No excess collateral to buy back!");

        // Make sure not to take more than is available
        uint256 stock_dollar_value_d18 = params.stockAmount.mul(params.stockPrice).div(1e6);
        require(
            stock_dollar_value_d18 <= params.excess_collateral_dollar_value_d18,
            "You are trying to buy back more than the excess!"
        );

        uint256 collateral_equivalent_d18 = stock_dollar_value_d18.mul(1e6).div(params.colPriceUsd);

        return (collateral_equivalent_d18);
    }

    // Returns value of collateral that must increase to reach recollateralization target (if 0 means no recollateralization)
    function recollateralizeAmount(
        uint256 total_supply,
        uint256 globalCollateralRatio,
        uint256 global_collat_value
    ) public pure returns (uint256) {
        uint256 target_collat_value = total_supply.mul(globalCollateralRatio).div(1e6);
        // We want 18 decimals of precision so divide by 1e6; total_supply is 1e18 and globalCollateralRatio is 1e6
        // Subtract the current value of collateral from the target value needed, if higher than 0 then system needs to recollateralize
        return target_collat_value.sub(global_collat_value);
        // If recollateralization is not needed, throws a subtraction underflow
        // return(recollateralization_left);
    }

    function calcRecollateralizeStableInner(
        uint256 collateralAmount,
        uint256 col_price,
        uint256 global_collat_value,
        uint256 frax_total_supply,
        uint256 globalCollateralRatio
    ) public pure returns (uint256, uint256) {
        uint256 collat_value_attempted = collateralAmount.mul(col_price).div(1e6);
        uint256 effective_collateral_ratio = global_collat_value.mul(1e6).div(frax_total_supply);
        //returns it in 1e6
        uint256 recollat_possible = (
            globalCollateralRatio.mul(frax_total_supply).sub(frax_total_supply.mul(effective_collateral_ratio))
        ).div(1e6);

        uint256 amount_to_recollat;
        if (collat_value_attempted <= recollat_possible) {
            amount_to_recollat = collat_value_attempted;
        } else {
            amount_to_recollat = recollat_possible;
        }

        return (amount_to_recollat.mul(1e6).div(col_price), amount_to_recollat);
    }
}
