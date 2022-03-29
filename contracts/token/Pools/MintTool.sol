// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.6.11;

import "./FraxPool.sol";
import "../../Staking/Owned.sol";
import "../AbstractPausable.sol";
import "../FXS/FXS.sol";
import "../../token/Frax.sol";
import "./FraxPoolLibrary.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MintTool is AbstractPausable {
    using SafeMath for uint256;

    UniswapPairOracle private collatEthOracle;
    address public collat_eth_oracle_address;
    address private weth_address;
    FraxPool private collatFraxPool;
    FRAXShares private FXS;
    FRAXStablecoin private FRAX;
    ERC20 private collateral_token;
    address private collateral_address;
    // Number of decimals needed to get to 18
    uint256 private immutable missing_decimals;

    // Constants for various precisions
    uint256 private constant PRICE_PRECISION = 1e6;

    constructor(
        address _pool_address,
        address _frax_contract_address,
        address _fxs_contract_address,
        address _collateral_address
    ) public {
        require(
            (_frax_contract_address != address(0)) &&
                (_fxs_contract_address != address(0)),
            "Zero address detected"
        );
        FRAX = FRAXStablecoin(_frax_contract_address);
        FXS = FRAXShares(_fxs_contract_address);
        collatFraxPool = FraxPool(_pool_address);
        collateral_address = _collateral_address;
        collateral_token = ERC20(_collateral_address);
        missing_decimals = uint256(18).sub(collateral_token.decimals());
    }

    function calcMintExpected1t1FRAX(uint256 collateral_amount)
        public
        view
        returns (uint256 expected)
    {
        uint256 globalCollateralRatio = FRAX.globalCollateralRatio();

        require(globalCollateralRatio >= 1e6, "Collateral ratio must be >= 1");

        uint256 minting_fee = collatFraxPool.minting_fee();
        uint256 collateral_amount_d18 = collateral_amount *
            (10**missing_decimals);

        uint256 frax_amount_d18 = FraxPoolLibrary.calcMint1t1FRAX(
            collatFraxPool.getCollateralPrice(),
            collateral_amount_d18
        );
        frax_amount_d18 = (frax_amount_d18.mul(uint256(1e6).sub(minting_fee)))
            .div(1e6);
        return (frax_amount_d18);
    }

    function calcMintExpectedFractionalFRAX(
        uint256 collateral_amount,
        uint256 fxs_amount
    ) public view returns (uint256 expected_amount, uint256 needed) {
        // uint256 fxs_amount = collateral_amount;
        uint256 fxs_price = FRAX.fxsPrice();
        uint256 globalCollateralRatio = FRAX.globalCollateralRatio();
        uint256 minting_fee = collatFraxPool.minting_fee();
        uint256 collateralPrice = collatFraxPool.getCollateralPrice();

        require(
            globalCollateralRatio < 1e6 && globalCollateralRatio > 0,
            "Collateral ratio needs to be between .000001 and .999999"
        );

        require(
            collateral_amount != 0 || fxs_amount != 0,
            "Collateral amount and fxs amount are 0 at the same time"
        );

        uint256 collateral_amount_d18 = collateral_amount *
            (10**missing_decimals);

        FraxPoolLibrary.MintFF_Params memory input_params = FraxPoolLibrary
            .MintFF_Params(
                fxs_price,
                collateralPrice,
                fxs_amount,
                collateral_amount_d18,
                globalCollateralRatio
            );

        if (collateral_amount != 0) {
            (
                uint256 mint_amount,
                uint256 mint_needed
            ) = calcMintFractionalFRAXByCol(input_params);
            mint_amount = (mint_amount.mul(uint256(1e6).sub(minting_fee))).div(
                1e6
            );

            return (mint_amount, mint_needed);
        }
        if (fxs_amount != 0) {
            (
                uint256 mint_amount,
                uint256 mint_needed
            ) = calcMintFractionalFRAXByFxs(input_params);
            mint_amount = (mint_amount.mul(uint256(1e6).sub(minting_fee))).div(
                1e6
            );

            return (mint_amount, mint_needed);
        }
    }

    function calcMintExpectedAlgorithmic(uint256 fxs_amount_d18)
        public
        view
        returns (uint256 expected)
    {
        uint256 fxs_price = FRAX.fxsPrice();

        require(
            FRAX.globalCollateralRatio() == 0,
            "Collateral ratio must be 0"
        );

        uint256 minting_fee = collatFraxPool.minting_fee();
        uint256 frax_amount_d18 = FraxPoolLibrary.calcMintAlgorithmicFRAX(
            fxs_price, // X FXS / 1 USD
            fxs_amount_d18
        );

        frax_amount_d18 = (frax_amount_d18.mul(uint256(1e6).sub(minting_fee)))
            .div(1e6);

        return frax_amount_d18;
    }

    function calcRedeemExpected1t1FRAX(uint256 FRAX_amount)
        public
        view
        returns (uint256 expected)
    {
        uint256 FRAX_amount_precision = FRAX_amount.div(10**missing_decimals);
        uint256 redemption_fee = collatFraxPool.redemption_fee();
        uint256 globalCollateralRatio = FRAX.globalCollateralRatio();

        require(globalCollateralRatio >= 1e6, "Collateral ratio must be >= 1");

        uint256 collateral_needed = FraxPoolLibrary.calcRedeem1t1FRAX(
            collatFraxPool.getCollateralPrice(),
            FRAX_amount_precision
        );

        collateral_needed = (
            collateral_needed.mul(uint256(1e6).sub(redemption_fee))
        ).div(1e6);

        return (collateral_needed);
    }

    function calcRedeemExpectedFractionalFRAX(uint256 FRAX_amount)
        public
        view
        returns (uint256 token_amount, uint256 Fxs_amount)
    {
        uint256 fxs_price = FRAX.fxsPrice();
        uint256 globalCollateralRatio = FRAX.globalCollateralRatio();

        require(
            globalCollateralRatio < 1e6 && globalCollateralRatio > 0,
            "Collateral ratio needs to be between .000001 and .999999"
        );

        uint256 col_price_usd = collatFraxPool.getCollateralPrice();
        uint256 redemption_fee = collatFraxPool.redemption_fee();
        uint256 FRAX_amount_post_fee = (
            FRAX_amount.mul(uint256(1e6).sub(redemption_fee))
        ).div(PRICE_PRECISION);

        uint256 fxs_dollar_value_d18 = FRAX_amount_post_fee.sub(
            FRAX_amount_post_fee.mul(globalCollateralRatio).div(PRICE_PRECISION)
        );
        uint256 fxs_amount = fxs_dollar_value_d18.mul(PRICE_PRECISION).div(
            fxs_price
        );

        uint256 FRAX_amount_precision = FRAX_amount_post_fee.div(
            10**missing_decimals
        );
        uint256 collateral_dollar_value = FRAX_amount_precision
            .mul(globalCollateralRatio)
            .div(PRICE_PRECISION);
        uint256 collateral_amount = collateral_dollar_value
            .mul(PRICE_PRECISION)
            .div(col_price_usd);

        return (collateral_amount, fxs_amount);
    }

    function calcRedeemExpectedAlgorithmic(uint256 FRAX_amount)
        public
        view
        returns (uint256 expected)
    {
        uint256 fxs_price = FRAX.fxsPrice();
        uint256 globalCollateralRatio = FRAX.globalCollateralRatio();

        require(globalCollateralRatio == 0, "Collateral ratio must be 0");

        uint256 fxs_dollar_value_d18 = FRAX_amount;
        uint256 redemption_fee = collatFraxPool.redemption_fee();

        fxs_dollar_value_d18 = (
            fxs_dollar_value_d18.mul(uint256(1e6).sub(redemption_fee))
        ).div(PRICE_PRECISION);
        //apply fees

        uint256 fxs_amount = fxs_dollar_value_d18.mul(PRICE_PRECISION).div(
            fxs_price
        );

        return fxs_amount;
    }

    // Must be internal because of the struct
    // function calcMintFractionalFRAX(uint256 fxs_amount, uint256 fxs_price_usd)
    function calcMintFractionalFRAXByCol(
        FraxPoolLibrary.MintFF_Params memory params
    ) internal pure returns (uint256, uint256) {
        // Since solidity truncates division, every division operation must be the last operation in the equation to ensure minimum error
        // The contract must check the proper ratio was sent to mint FRAX. We do this by seeing the minimum mintable FRAX based on each amount
        uint256 fxs_dollar_value_d18;
        uint256 c_dollar_value_d18;

        // Scoping for stack concerns
        {
            // USD amounts of the collateral and the FXS
            fxs_dollar_value_d18 = params
                .fxs_amount
                .mul(params.fxs_price_usd)
                .div(1e6);
            c_dollar_value_d18 = params
                .collateral_amount
                .mul(params.col_price_usd)
                .div(1e6);
        }

        uint256 calculated_fxs_dollar_value_d18 = (
            c_dollar_value_d18.mul(1e6).div(params.col_ratio)
        ).sub(c_dollar_value_d18);

        uint256 calculated_fxs_needed = calculated_fxs_dollar_value_d18
            .mul(1e6)
            .div(params.fxs_price_usd);

        return (
            c_dollar_value_d18.add(calculated_fxs_dollar_value_d18),
            calculated_fxs_needed
        );
    }

    function calcMintFractionalFRAXByFxs(
        FraxPoolLibrary.MintFF_Params memory params
    ) internal pure returns (uint256, uint256) {
        // Since solidity truncates division, every division operation must be the last operation in the equation to ensure minimum error
        // The contract must check the proper ratio was sent to mint FRAX. We do this by seeing the minimum mintable FRAX based on each amount
        uint256 fxs_dollar_value_d18;
        uint256 c_dollar_value_d18;

        // Scoping for stack concerns
        {
            // USD amounts of the collateral and the FXS
            fxs_dollar_value_d18 = params
                .fxs_amount
                .mul(params.fxs_price_usd)
                .div(1e6);
            c_dollar_value_d18 = params
                .collateral_amount
                .mul(params.col_price_usd)
                .div(1e6);
        }

        // uint256 calculated_fxs_dollar_value_d18 = (
        //     c_dollar_value_d18.mul(1e6).div(params.col_ratio)
        // ).sub(c_dollar_value_d18);
        uint256 calculated_col_dollar_value_d18 = (
            fxs_dollar_value_d18.mul(1e6).div(1e6 - params.col_ratio)
        ).sub(fxs_dollar_value_d18);

        uint256 calculated_col_needed = calculated_col_dollar_value_d18
            .mul(1e6)
            .div(params.col_price_usd);

        return (
            fxs_dollar_value_d18.add(calculated_col_dollar_value_d18),
            calculated_col_needed
        );
    }

    //
}
