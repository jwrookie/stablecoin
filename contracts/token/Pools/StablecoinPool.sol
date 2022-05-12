// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "../../interface/IAMOMinter.sol";
import "../../tools/TransferHelper.sol";
import "../../token/Rusd.sol";
import "../../Oracle/UniswapPairOracle.sol";
import "./PoolLibrary.sol";
import "../../tools/Multicall.sol";
import "../../tools/AbstractPausable.sol";
import "../stock/Stock.sol";

contract StablecoinPool is AbstractPausable, Multicall {
    using SafeMath for uint256;


    // Constants for various precisions
    uint256 private constant PRICE_PRECISION = 1e6;
    uint256 private constant COLLATERAL_RATIO_PRECISION = 1e6;
    uint256 private constant COLLATERAL_RATIO_MAX = 1e6;


    // Number of decimals needed to get to 18
    uint256 public immutable missingDecimals;

    ERC20 public immutable collateralToken;

    Stock public immutable stock;
    RStablecoin public immutable stable;

    UniswapPairOracle public collatEthOracle;
    address public weth;

    uint256 public mintingFee;
    uint256 public redemptionFee;
    uint256 public buybackFee;
    uint256 public recollatFee;

    mapping(address => uint256) public redeemStockBalances;
    mapping(address => uint256) public redeemCollateralBalances;
    uint256 public unclaimedPoolCollateral;
    uint256 public unclaimedPoolStock;


    // Pool_ceiling is the total units of collateral that a pool contract can hold
    uint256 public poolCeiling = 0;

    // Stores price of the collateral, if price is paused
    uint256 public pausedPrice = 0;

    uint256 public bonusRate = 7500;

    // Number of blocks to wait before being able to collectRedemption()
    uint256 public redemptionDelay = 1;

    mapping(address => bool) public amoMinterAddresses; // minter address -> is it enabled

    constructor(
        address _operatorMsg,
        address _stableContract,
        address _stockContract,
        address _collateralAddress,
        uint256 _poolCeiling
    ) public AbstractPausable(_operatorMsg) {
        require(
            (_stableContract != address(0)) &&
            (_stockContract != address(0)) &&
            (_collateralAddress != address(0)),
            "0 address"
        );
        stable = RStablecoin(_stableContract);
        stock = Stock(_stockContract);
        collateralToken = ERC20(_collateralAddress);
        poolCeiling = _poolCeiling;
        missingDecimals = uint256(18).sub(collateralToken.decimals());
    }

    modifier onlyAMOMinters() {
        require(amoMinterAddresses[msg.sender], "Not an AMO Minter");
        _;
    }

    function addAMOMinter(address amoMinter) external onlyOperator {
        require(amoMinter != address(0), "0 address");

        // Make sure the AMO Minter has collatDollarBalance()
        uint256 collatValE18 = IAMOMinter(amoMinter).collatDollarBalance();
        require(collatValE18 >= 0, "Invalid AMO");

        amoMinterAddresses[amoMinter] = true;

        emit AMOMinterAdded(amoMinter);
    }

    function removeAMOMinter(address amoMinter) external onlyOperator {
        amoMinterAddresses[amoMinter] = false;

        emit AMOMinterRemoved(amoMinter);
    }


    // Returns dollar value of collateral held in this Stable pool
    function collatDollarBalance() public view returns (uint256) {
        if (paused() == true) {
            return
            (collateralToken.balanceOf(address(this)).sub(unclaimedPoolCollateral))
            .mul(10 ** missingDecimals)
            .mul(pausedPrice)
            .div(PRICE_PRECISION);
        } else {
            uint256 ethUsdPrice = stable.ethUsdPrice();
            uint256 ethCollatPrice = collatEthOracle.consult(
                weth,
                (PRICE_PRECISION * (10 ** missingDecimals))
            );

            uint256 collatUsdPrice = ethUsdPrice.mul(PRICE_PRECISION).div(ethCollatPrice);
            return
            (collateralToken.balanceOf(address(this)).sub(unclaimedPoolCollateral))
            .mul(10 ** missingDecimals)
            .mul(collatUsdPrice)
            .div(PRICE_PRECISION);
            //.mul(getCollateralPrice()).div(1e6);
        }
    }


    function availableExcessCollatDV() public view returns (uint256) {
        uint256 totalSupply = stable.totalSupply();
        uint256 globalCollateralRatio = stable.globalCollateralRatio();
        uint256 globalCollatValue = stable.globalCollateralValue();

        if (globalCollateralRatio > COLLATERAL_RATIO_PRECISION) globalCollateralRatio = COLLATERAL_RATIO_PRECISION;
        // Handles an overcollateralized contract with CR > 1
        uint256 requiredCollatDollarValueD18 = (totalSupply.mul(globalCollateralRatio)).div(
            COLLATERAL_RATIO_PRECISION
        );
        // Calculates collateral needed to back each 1 FRAX with $1 of collateral at current collat ratio
        if (globalCollatValue > requiredCollatDollarValueD18)
            return globalCollatValue.sub(requiredCollatDollarValueD18);
        else return 0;
    }



    // Returns the price of the pool collateral in USD
    function getCollateralPrice() public view returns (uint256) {
        if (paused() == true) {
            return pausedPrice;
        } else {
            uint256 ethUsdPrice = stable.ethUsdPrice();
            return
            ethUsdPrice.mul(PRICE_PRECISION).div(
                collatEthOracle.consult(weth, PRICE_PRECISION * (10 ** missingDecimals))
            );
        }
    }

    function setCollatETHOracle(address _collateralEthOracleAddress, address _weth) external onlyOperator {
        collatEthOracle = UniswapPairOracle(_collateralEthOracleAddress);
        weth = _weth;
    }

    // We separate out the 1t1, fractional and algorithmic minting functions for gas efficiency
    function mint1t1Stable(uint256 collateralAmount, uint256 outMin) external whenNotPaused {
        uint256 collateralAmountD18 = collateralAmount * (10 ** missingDecimals);

        require(stable.globalCollateralRatio() >= COLLATERAL_RATIO_MAX, "Collateral ratio must be >= 1");
        require(
            (collateralToken.balanceOf(address(this))).sub(unclaimedPoolCollateral).add(collateralAmount) <=
            poolCeiling,
            "[Pool's Closed]: Ceiling reached"
        );

        uint256 stableAmount = PoolLibrary.calcMint1t1Stable(getCollateralPrice(), collateralAmountD18);
        //1 Stable for each $1 worth of collateral

        stableAmount = (stableAmount.mul(uint256(1e6).sub(mintingFee))).div(1e6);
        //remove precision at the end
        require(outMin <= stableAmount, "Slippage limit reached");

        TransferHelper.safeTransferFrom(address(collateralToken), msg.sender, address(this), collateralAmount);
        stable.poolMint(msg.sender, stableAmount);
    }

    // 0% collateral-backed
    function mintAlgorithmicStable(uint256 stockAmountD18, uint256 stableOutMin) external whenNotPaused {
        uint256 fxs_price = stable.stockPrice();
        require(stable.globalCollateralRatio() == 0, "Collateral ratio must be 0");

        uint256 stableAmointD18 = PoolLibrary.calcMintAlgorithmicStable(
            fxs_price, // X stock / 1 USD
            stockAmountD18
        );

        stableAmointD18 = (stableAmointD18.mul(uint256(1e6).sub(mintingFee))).div(1e6);
        require(stableOutMin <= stableAmointD18, "Slippage limit reached");

        stock.poolBurnFrom(msg.sender, stockAmountD18);
        stable.poolMint(msg.sender, stableAmointD18);
    }

    // Will fail if fully collateralized or fully algorithmic
    // > 0% and < 100% collateral-backed
    function mintFractionalStable(
        uint256 collateralAmount,
        uint256 stockAmount,
        uint256 stableOutMin
    ) external whenNotPaused {
        uint256 stockPrice = stable.stockPrice();
        uint256 globalCollateralRatio = stable.globalCollateralRatio();

        require(
            globalCollateralRatio < COLLATERAL_RATIO_MAX && globalCollateralRatio > 0,
            "Collateral ratio needs to be between .000001 and .999999"
        );
        require(
            collateralToken.balanceOf(address(this)).sub(unclaimedPoolCollateral).add(collateralAmount) <=
            poolCeiling,
            "Pool ceiling reached, no more FRAX can be minted with this collateral"
        );

        uint256 collateralAmount = collateralAmount * (10 ** missingDecimals);
        PoolLibrary.MintFF_Params memory input_params = PoolLibrary.MintFF_Params(
            stockPrice,
            getCollateralPrice(),
            stockAmount,
            collateralAmount,
            globalCollateralRatio
        );

        (uint256 mintAmount, uint256 stockNeeded) = PoolLibrary.calcMintFractionalStable(input_params);

        mintAmount = (mintAmount.mul(uint256(1e6).sub(mintingFee))).div(1e6);
        require(stableOutMin <= mintAmount, "Slippage limit reached");
        require(stockNeeded <= stockAmount, "Not enough FXS inputted");

        stock.poolBurnFrom(msg.sender, stockNeeded);
        TransferHelper.safeTransferFrom(address(collateralToken), msg.sender, address(this), collateralAmount);
        stable.poolMint(msg.sender, mintAmount);
    }

    // Redeem collateral. 100% collateral-backed
    function redeem1t1Stable(uint256 stableAmount, uint256 collateralOutMin) external whenNotPaused {
        require(stable.globalCollateralRatio() == COLLATERAL_RATIO_MAX, "Collateral ratio must be == 1");

        // Need to adjust for decimals of collateral
        uint256 stableAmountPrecision = stableAmount.div(10 ** missingDecimals);
        uint256 collateralNeeded = PoolLibrary.calcRedeem1t1Stable(getCollateralPrice(), stableAmountPrecision);

        collateralNeeded = (collateralNeeded.mul(uint256(1e6).sub(redemptionFee))).div(1e6);
        require(
            collateralNeeded <= collateralToken.balanceOf(address(this)).sub(unclaimedPoolCollateral),
            "Not enough collateral in pool"
        );
        require(collateralOutMin <= collateralNeeded, "Slippage limit reached");

        redeemCollateralBalances[msg.sender] = redeemCollateralBalances[msg.sender].add(collateralNeeded);
        unclaimedPoolCollateral = unclaimedPoolCollateral.add(collateralNeeded);

        // Move all external functions to the end
        stable.poolBurnFrom(msg.sender, stableAmount);
    }

    // Will fail if fully collateralized or algorithmic
    // Redeem Stable for collateral and stock. > 0% and < 100% collateral-backed
    function redeemFractionalStable(
        uint256 stableAmount,
        uint256 stockOutMin,
        uint256 collateralOutMin
    ) external whenNotPaused {
        uint256 stockPrice = stable.stockPrice();
        uint256 globalCollateralRatio = stable.globalCollateralRatio();

        require(
            globalCollateralRatio < COLLATERAL_RATIO_MAX && globalCollateralRatio > 0,
            "Collateral ratio needs to be between .000001 and .999999"
        );
        uint256 colPriceUsd = getCollateralPrice();

        uint256 stableAmountPostFee = (stableAmount.mul(uint256(1e6).sub(redemptionFee))).div(PRICE_PRECISION);

        uint256 stockDollarValueD18 = stableAmountPostFee.sub(
            stableAmountPostFee.mul(globalCollateralRatio).div(PRICE_PRECISION)
        );
        uint256 stockAmount = stockDollarValueD18.mul(PRICE_PRECISION).div(stockPrice);

        // Need to adjust for decimals of collateral
        uint256 stableAmountPrecision = stableAmountPostFee.div(10 ** missingDecimals);
        uint256 collateralDollarValue = stableAmountPrecision.mul(globalCollateralRatio).div(PRICE_PRECISION);
        uint256 collateralAmount = collateralDollarValue.mul(PRICE_PRECISION).div(colPriceUsd);

        require(
            collateralAmount <= collateralToken.balanceOf(address(this)).sub(unclaimedPoolCollateral),
            "Not enough collateral in pool"
        );
        require(collateralOutMin <= collateralAmount, "Slippage limit reached [collateral]");
        require(stockOutMin <= stockAmount, "Slippage limit reached [stock]");

        redeemCollateralBalances[msg.sender] = redeemCollateralBalances[msg.sender].add(collateralAmount);
        unclaimedPoolCollateral = unclaimedPoolCollateral.add(collateralAmount);

        redeemStockBalances[msg.sender] = redeemStockBalances[msg.sender].add(stockAmount);
        unclaimedPoolStock = unclaimedPoolStock.add(stockAmount);

        // Move all external functions to the end
        stable.poolBurnFrom(msg.sender, stableAmount);
        stock.poolMint(address(this), stockAmount);
    }

    // Redeem stable for stock. 0% collateral-backed
    function redeemAlgorithmicStable(uint256 FRAX_amount, uint256 FXS_out_min) external whenNotPaused {
        uint256 fxs_price = stable.stockPrice();
        uint256 globalCollateralRatio = stable.globalCollateralRatio();

        require(globalCollateralRatio == 0, "Collateral ratio must be 0");
        uint256 fxs_dollar_value_d18 = FRAX_amount;

        fxs_dollar_value_d18 = (fxs_dollar_value_d18.mul(uint256(1e6).sub(redemptionFee))).div(PRICE_PRECISION);
        //apply fees

        uint256 fxs_amount = fxs_dollar_value_d18.mul(PRICE_PRECISION).div(fxs_price);

        redeemStockBalances[msg.sender] = redeemStockBalances[msg.sender].add(fxs_amount);
        unclaimedPoolStock = unclaimedPoolStock.add(fxs_amount);

        require(FXS_out_min <= fxs_amount, "Slippage limit reached");
        // Move all external functions to the end
        stable.poolBurnFrom(msg.sender, FRAX_amount);
        stock.poolMint(address(this), fxs_amount);
    }

    // After a redemption happens, transfer the newly minted FXS and owed collateral from this pool
    // contract to the user. Redemption is split into two functions to prevent flash loans from being able
    // to take out FRAX/collateral from the system, use an AMM to trade the new price, and then mint back into the system.
    // Must wait for (AEO or Whitelist) blocks before collecting redemption
    function collectRedemption() external onlyAEOWhiteList {
        bool sendFXS = false;
        bool sendCollateral = false;
        uint256 FXSAmount = 0;
        uint256 CollateralAmount = 0;

        // Use Checks-Effects-Interactions pattern
        if (redeemStockBalances[msg.sender] > 0) {
            FXSAmount = redeemStockBalances[msg.sender];
            redeemStockBalances[msg.sender] = 0;
            unclaimedPoolStock = unclaimedPoolStock.sub(FXSAmount);

            sendFXS = true;
        }

        if (redeemCollateralBalances[msg.sender] > 0) {
            CollateralAmount = redeemCollateralBalances[msg.sender];
            redeemCollateralBalances[msg.sender] = 0;
            unclaimedPoolCollateral = unclaimedPoolCollateral.sub(CollateralAmount);

            sendCollateral = true;
        }

        if (sendFXS) {
            TransferHelper.safeTransfer(address(stock), msg.sender, FXSAmount);
        }
        if (sendCollateral) {
            TransferHelper.safeTransfer(address(collateralToken), msg.sender, CollateralAmount);
        }
    }

    // Bypasses the gassy mint->redeem cycle for AMOs to borrow collateral
    function amoMinterBorrow(uint256 collateral_amount) external whenNotPaused onlyAMOMinters {
        // Transfer
        TransferHelper.safeTransfer(address(collateralToken), msg.sender, collateral_amount);
    }

    // When the protocol is recollateralizing, we need to give a discount of FXS to hit the new CR target
    // Thus, if the target collateral ratio is higher than the actual value of collateral, minters get FXS for adding collateral
    // This function simply rewards anyone that sends collateral to a pool with the same amount of FXS + the bonus rate
    // Anyone can call this function to recollateralize the protocol and take the extra FXS value from the bonus rate as an arb opportunity
    function recollateralizeStable(uint256 collateral_amount, uint256 FXS_out_min) external {
        require(paused() == false, "Recollateralize is paused");
        uint256 collateral_amount_d18 = collateral_amount * (10 ** missingDecimals);
        uint256 fxs_price = stable.stockPrice();
        uint256 frax_total_supply = stable.totalSupply();
        uint256 globalCollateralRatio = stable.globalCollateralRatio();
        uint256 global_collat_value = stable.globalCollateralValue();

        (uint256 collateral_units, uint256 amount_to_recollat) = PoolLibrary.calcRecollateralizeStableInner(
            collateral_amount_d18,
            getCollateralPrice(),
            global_collat_value,
            frax_total_supply,
            globalCollateralRatio
        );

        uint256 collateral_units_precision = collateral_units.div(10 ** missingDecimals);

        uint256 fxs_paid_back = amount_to_recollat.mul(uint256(1e6).add(bonusRate).sub(recollatFee)).div(fxs_price);

        require(FXS_out_min <= fxs_paid_back, "Slippage limit reached");
        TransferHelper.safeTransferFrom(
            address(collateralToken),
            msg.sender,
            address(this),
            collateral_units_precision
        );
        stock.poolMint(msg.sender, fxs_paid_back);
    }

    // Function can be called by an FXS holder to have the protocol buy back FXS with excess collateral value from a desired collateral pool
    // This can also happen if the collateral ratio > 1
    function buyBackStock(uint256 FXS_amount, uint256 COLLATERAL_out_min) external {
        require(paused() == false, "Buyback is paused");
        uint256 fxs_price = stable.stockPrice();

        PoolLibrary.BuybackStock_Params memory input_params = PoolLibrary.BuybackStock_Params(
            availableExcessCollatDV(),
            fxs_price,
            getCollateralPrice(),
            FXS_amount
        );

        uint256 collateral_equivalent_d18 = (PoolLibrary.calcBuyBackStock(input_params))
        .mul(uint256(1e6).sub(buybackFee))
        .div(1e6);
        uint256 collateral_precision = collateral_equivalent_d18.div(10 ** missingDecimals);

        require(COLLATERAL_out_min <= collateral_precision, "Slippage limit reached");
        // Give the sender their desired collateral and burn the FXS
        stock.poolBurnFrom(msg.sender, FXS_amount);
        TransferHelper.safeTransfer(address(collateralToken), msg.sender, collateral_precision);
    }

    // Combined into one function due to 24KiB contract memory limit
    function setPoolParameters(
        uint256 new_ceiling,
        uint256 new_bonus_rate,
        uint256 new_redemption_delay,
        uint256 new_mint_fee,
        uint256 new_redeem_fee,
        uint256 new_buybackFee,
        uint256 new_recollatFee
    ) external onlyOperator {
        poolCeiling = new_ceiling;
        bonusRate = new_bonus_rate;
        redemptionDelay = new_redemption_delay;
        mintingFee = new_mint_fee;
        redemptionFee = new_redeem_fee;
        buybackFee = new_buybackFee;
        recollatFee = new_recollatFee;

        emit PoolParametersSet(
            new_ceiling,
            new_bonus_rate,
            new_redemption_delay,
            new_mint_fee,
            new_redeem_fee,
            new_buybackFee,
            new_recollatFee
        );
    }

    event AMOMinterAdded(address amo_minter_addr);
    event AMOMinterRemoved(address amo_minter_addr);
    event PoolParametersSet(
        uint256 new_ceiling,
        uint256 new_bonus_rate,
        uint256 new_redemption_delay,
        uint256 new_mint_fee,
        uint256 new_redeem_fee,
        uint256 new_buybackFee,
        uint256 new_recollatFee
    );
}
