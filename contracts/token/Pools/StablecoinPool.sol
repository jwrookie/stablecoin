// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.6.11;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "../../interface/IAMOMinter.sol";
import '../../tools/TransferHelper.sol';
import "../../token/Rusd.sol";
import "../../Oracle/UniswapPairOracle.sol";
import "./PoolLibrary.sol";
import "../../tools/Multicall.sol";
import "../../tools/AbstractPausable.sol";
import "../stock/Stock.sol";

contract StablecoinPool is AbstractPausable, Multicall {
    using SafeMath for uint256;

    /* ========== STATE VARIABLES ========== */

    ERC20 private collateral_token;
    address private collateralAddress;

    Stock private FXS;
    RStablecoin private FRAX;

    UniswapPairOracle private collatEthOracle;
    address public collat_eth_oracle_address;
    address private weth_address;

    uint256 public minting_fee;
    uint256 public redemption_fee;
    uint256 public buyback_fee;
    uint256 public recollat_fee;

    mapping(address => uint256) public redeemFXSBalances;
    mapping(address => uint256) public redeemCollateralBalances;
    uint256 public unclaimedPoolCollateral;
    uint256 public unclaimedPoolFXS;

    // Constants for various precisions
    uint256 private constant PRICE_PRECISION = 1e6;
    uint256 private constant COLLATERAL_RATIO_PRECISION = 1e6;
    uint256 private constant COLLATERAL_RATIO_MAX = 1e6;

    // Number of decimals needed to get to 18
    uint256 private immutable missing_decimals;

    // Pool_ceiling is the total units of collateral that a pool contract can hold
    uint256 public pool_ceiling = 0;

    // Stores price of the collateral, if price is paused
    uint256 public pausedPrice = 0;

    // Bonus rate on FXS minted during recollateralizeFRAX(); 6 decimals of precision, set to 0.75% on genesis
    uint256 public bonus_rate = 7500;

    // Number of blocks to wait before being able to collectRedemption()
    uint256 public redemption_delay = 1;

    mapping(address => bool) public amo_minter_addresses; // minter address -> is it enabled

    constructor (
        address _operatorMsg,
        address _frax_contract_address,
        address _fxs_contract_address,
        address _collateral_address,
        uint256 _pool_ceiling
    ) public AbstractPausable(_operatorMsg) {
        require(
            (_frax_contract_address != address(0))
            && (_fxs_contract_address != address(0))
            && (_collateral_address != address(0))
        , "Zero address detected");
        FRAX = RStablecoin(_frax_contract_address);
        FXS = Stock(_fxs_contract_address);
        collateralAddress = _collateral_address;
        collateral_token = ERC20(_collateral_address);
        pool_ceiling = _pool_ceiling;
        missing_decimals = uint(18).sub(collateral_token.decimals());
    }

    modifier onlyAMOMinters() {
        require(amo_minter_addresses[msg.sender], "Not an AMO Minter");
        _;
    }

    // Add an AMO Minter
    function addAMOMinter(address amo_minter_addr) external onlyOwner {
        require(amo_minter_addr != address(0), "Zero address detected");

        // Make sure the AMO Minter has collatDollarBalance()
        uint256 collat_val_e18 = IAMOMinter(amo_minter_addr).collatDollarBalance();
        require(collat_val_e18 >= 0, "Invalid AMO");

        amo_minter_addresses[amo_minter_addr] = true;

        emit AMOMinterAdded(amo_minter_addr);
    }

    // Remove an AMO Minter
    function removeAMOMinter(address amo_minter_addr) external onlyOwner {
        amo_minter_addresses[amo_minter_addr] = false;

        emit AMOMinterRemoved(amo_minter_addr);
    }

    /* ========== VIEWS ========== */

    // Returns dollar value of collateral held in this Frax pool
    function collatDollarBalance() public view returns (uint256) {
        if (paused() == true) {
            return (collateral_token.balanceOf(address(this)).sub(unclaimedPoolCollateral)).mul(10 ** missing_decimals).mul(pausedPrice).div(PRICE_PRECISION);
        } else {
            uint256 eth_usd_price = FRAX.ethUsdPrice();
            uint256 eth_collat_price = collatEthOracle.consult(weth_address, (PRICE_PRECISION * (10 ** missing_decimals)));

            uint256 collat_usd_price = eth_usd_price.mul(PRICE_PRECISION).div(eth_collat_price);
            return (collateral_token.balanceOf(address(this)).sub(unclaimedPoolCollateral)).mul(10 ** missing_decimals).mul(collat_usd_price).div(PRICE_PRECISION);
            //.mul(getCollateralPrice()).div(1e6);
        }
    }

    // Returns the value of excess collateral held in this Frax pool, compared to what is needed to maintain the global collateral ratio
    function availableExcessCollatDV() public view returns (uint256) {
        uint256 total_supply = FRAX.totalSupply();
        uint256 globalCollateralRatio = FRAX.globalCollateralRatio();
        uint256 global_collat_value = FRAX.globalCollateralValue();

        if (globalCollateralRatio > COLLATERAL_RATIO_PRECISION) globalCollateralRatio = COLLATERAL_RATIO_PRECISION;
        // Handles an overcollateralized contract with CR > 1
        uint256 required_collat_dollar_value_d18 = (total_supply.mul(globalCollateralRatio)).div(COLLATERAL_RATIO_PRECISION);
        // Calculates collateral needed to back each 1 FRAX with $1 of collateral at current collat ratio
        if (global_collat_value > required_collat_dollar_value_d18) return global_collat_value.sub(required_collat_dollar_value_d18);
        else return 0;
    }

    /* ========== PUBLIC FUNCTIONS ========== */

    // Returns the price of the pool collateral in USD
    function getCollateralPrice() public view returns (uint256) {
        if (paused() == true) {
            return pausedPrice;
        } else {
            uint256 eth_usd_price = FRAX.ethUsdPrice();
            return eth_usd_price.mul(PRICE_PRECISION).div(collatEthOracle.consult(weth_address, PRICE_PRECISION * (10 ** missing_decimals)));
        }
    }

    function setCollatETHOracle(address _collateral_weth_oracle_address, address _weth_address) external onlyOwner {
        collat_eth_oracle_address = _collateral_weth_oracle_address;
        collatEthOracle = UniswapPairOracle(_collateral_weth_oracle_address);
        weth_address = _weth_address;
    }

    // We separate out the 1t1, fractional and algorithmic minting functions for gas efficiency
    function mint1t1FRAX(uint256 collateral_amount, uint256 FRAX_out_min) external whenNotPaused {
        uint256 collateral_amount_d18 = collateral_amount * (10 ** missing_decimals);

        require(FRAX.globalCollateralRatio() >= COLLATERAL_RATIO_MAX, "Collateral ratio must be >= 1");
        require((collateral_token.balanceOf(address(this))).sub(unclaimedPoolCollateral).add(collateral_amount) <= pool_ceiling, "[Pool's Closed]: Ceiling reached");

        (uint256 frax_amount_d18) = PoolLibrary.calcMint1t1Stable(
            getCollateralPrice(),
            collateral_amount_d18
        );
        //1 FRAX for each $1 worth of collateral

        frax_amount_d18 = (frax_amount_d18.mul(uint(1e6).sub(minting_fee))).div(1e6);
        //remove precision at the end
        require(FRAX_out_min <= frax_amount_d18, "Slippage limit reached");

        TransferHelper.safeTransferFrom(address(collateral_token), msg.sender, address(this), collateral_amount);
        FRAX.poolMint(msg.sender, frax_amount_d18);
    }

    // 0% collateral-backed
    function mintAlgorithmicFRAX(uint256 fxs_amount_d18, uint256 FRAX_out_min) external whenNotPaused {
        uint256 fxs_price = FRAX.stockPrice();
        require(FRAX.globalCollateralRatio() == 0, "Collateral ratio must be 0");

        (uint256 frax_amount_d18) = PoolLibrary.calcMintAlgorithmicStable(
            fxs_price, // X FXS / 1 USD
            fxs_amount_d18
        );

        frax_amount_d18 = (frax_amount_d18.mul(uint(1e6).sub(minting_fee))).div(1e6);
        require(FRAX_out_min <= frax_amount_d18, "Slippage limit reached");

        FXS.poolBurnFrom(msg.sender, fxs_amount_d18);
        FRAX.poolMint(msg.sender, frax_amount_d18);
    }

    // Will fail if fully collateralized or fully algorithmic
    // > 0% and < 100% collateral-backed
    function mintFractionalFRAX(uint256 collateral_amount, uint256 fxs_amount, uint256 FRAX_out_min) external whenNotPaused {
        uint256 fxs_price = FRAX.stockPrice();
        uint256 globalCollateralRatio = FRAX.globalCollateralRatio();

        require(globalCollateralRatio < COLLATERAL_RATIO_MAX && globalCollateralRatio > 0, "Collateral ratio needs to be between .000001 and .999999");
        require(collateral_token.balanceOf(address(this)).sub(unclaimedPoolCollateral).add(collateral_amount) <= pool_ceiling, "Pool ceiling reached, no more FRAX can be minted with this collateral");

        uint256 collateral_amount_d18 = collateral_amount * (10 ** missing_decimals);
        PoolLibrary.MintFF_Params memory input_params = PoolLibrary.MintFF_Params(
            fxs_price,
            getCollateralPrice(),
            fxs_amount,
            collateral_amount_d18,
            globalCollateralRatio
        );

        (uint256 mint_amount, uint256 fxs_needed) = PoolLibrary.calcMintFractionalStable(input_params);

        mint_amount = (mint_amount.mul(uint(1e6).sub(minting_fee))).div(1e6);
        require(FRAX_out_min <= mint_amount, "Slippage limit reached");
        require(fxs_needed <= fxs_amount, "Not enough FXS inputted");

        FXS.poolBurnFrom(msg.sender, fxs_needed);
        TransferHelper.safeTransferFrom(address(collateral_token), msg.sender, address(this), collateral_amount);
        FRAX.poolMint(msg.sender, mint_amount);
    }

    // Redeem collateral. 100% collateral-backed
    function redeem1t1FRAX(uint256 FRAX_amount, uint256 COLLATERAL_out_min) external whenNotPaused {
        require(FRAX.globalCollateralRatio() == COLLATERAL_RATIO_MAX, "Collateral ratio must be == 1");

        // Need to adjust for decimals of collateral
        uint256 FRAX_amount_precision = FRAX_amount.div(10 ** missing_decimals);
        (uint256 collateral_needed) = PoolLibrary.calcRedeem1t1Stable(
            getCollateralPrice(),
            FRAX_amount_precision
        );

        collateral_needed = (collateral_needed.mul(uint(1e6).sub(redemption_fee))).div(1e6);
        require(collateral_needed <= collateral_token.balanceOf(address(this)).sub(unclaimedPoolCollateral), "Not enough collateral in pool");
        require(COLLATERAL_out_min <= collateral_needed, "Slippage limit reached");

        redeemCollateralBalances[msg.sender] = redeemCollateralBalances[msg.sender].add(collateral_needed);
        unclaimedPoolCollateral = unclaimedPoolCollateral.add(collateral_needed);

        // Move all external functions to the end
        FRAX.poolBurnFrom(msg.sender, FRAX_amount);
    }

    // Will fail if fully collateralized or algorithmic
    // Redeem FRAX for collateral and FXS. > 0% and < 100% collateral-backed
    function redeemFractionalFRAX(uint256 FRAX_amount, uint256 FXS_out_min, uint256 COLLATERAL_out_min) external whenNotPaused {
        uint256 fxs_price = FRAX.stockPrice();
        uint256 globalCollateralRatio = FRAX.globalCollateralRatio();

        require(globalCollateralRatio < COLLATERAL_RATIO_MAX && globalCollateralRatio > 0, "Collateral ratio needs to be between .000001 and .999999");
        uint256 col_price_usd = getCollateralPrice();

        uint256 FRAX_amount_post_fee = (FRAX_amount.mul(uint(1e6).sub(redemption_fee))).div(PRICE_PRECISION);

        uint256 fxs_dollar_value_d18 = FRAX_amount_post_fee.sub(FRAX_amount_post_fee.mul(globalCollateralRatio).div(PRICE_PRECISION));
        uint256 fxs_amount = fxs_dollar_value_d18.mul(PRICE_PRECISION).div(fxs_price);

        // Need to adjust for decimals of collateral
        uint256 FRAX_amount_precision = FRAX_amount_post_fee.div(10 ** missing_decimals);
        uint256 collateral_dollar_value = FRAX_amount_precision.mul(globalCollateralRatio).div(PRICE_PRECISION);
        uint256 collateral_amount = collateral_dollar_value.mul(PRICE_PRECISION).div(col_price_usd);


        require(collateral_amount <= collateral_token.balanceOf(address(this)).sub(unclaimedPoolCollateral), "Not enough collateral in pool");
        require(COLLATERAL_out_min <= collateral_amount, "Slippage limit reached [collateral]");
        require(FXS_out_min <= fxs_amount, "Slippage limit reached [FXS]");

        redeemCollateralBalances[msg.sender] = redeemCollateralBalances[msg.sender].add(collateral_amount);
        unclaimedPoolCollateral = unclaimedPoolCollateral.add(collateral_amount);

        redeemFXSBalances[msg.sender] = redeemFXSBalances[msg.sender].add(fxs_amount);
        unclaimedPoolFXS = unclaimedPoolFXS.add(fxs_amount);

        // Move all external functions to the end
        FRAX.poolBurnFrom(msg.sender, FRAX_amount);
        FXS.poolMint(address(this), fxs_amount);
    }

    // Redeem FRAX for FXS. 0% collateral-backed
    function redeemAlgorithmicFRAX(uint256 FRAX_amount, uint256 FXS_out_min) external whenNotPaused {
        uint256 fxs_price = FRAX.stockPrice();
        uint256 globalCollateralRatio = FRAX.globalCollateralRatio();

        require(globalCollateralRatio == 0, "Collateral ratio must be 0");
        uint256 fxs_dollar_value_d18 = FRAX_amount;

        fxs_dollar_value_d18 = (fxs_dollar_value_d18.mul(uint(1e6).sub(redemption_fee))).div(PRICE_PRECISION);
        //apply fees

        uint256 fxs_amount = fxs_dollar_value_d18.mul(PRICE_PRECISION).div(fxs_price);

        redeemFXSBalances[msg.sender] = redeemFXSBalances[msg.sender].add(fxs_amount);
        unclaimedPoolFXS = unclaimedPoolFXS.add(fxs_amount);

        require(FXS_out_min <= fxs_amount, "Slippage limit reached");
        // Move all external functions to the end
        FRAX.poolBurnFrom(msg.sender, FRAX_amount);
        FXS.poolMint(address(this), fxs_amount);
    }

    // After a redemption happens, transfer the newly minted FXS and owed collateral from this pool
    // contract to the user. Redemption is split into two functions to prevent flash loans from being able
    // to take out FRAX/collateral from the system, use an AMM to trade the new price, and then mint back into the system.
    // Must wait for (AEO or Whitelist) blocks before collecting redemption
    function collectRedemption() external onlyAEOWhiteList {

        bool sendFXS = false;
        bool sendCollateral = false;
        uint FXSAmount = 0;
        uint CollateralAmount = 0;

        // Use Checks-Effects-Interactions pattern
        if (redeemFXSBalances[msg.sender] > 0) {
            FXSAmount = redeemFXSBalances[msg.sender];
            redeemFXSBalances[msg.sender] = 0;
            unclaimedPoolFXS = unclaimedPoolFXS.sub(FXSAmount);

            sendFXS = true;
        }

        if (redeemCollateralBalances[msg.sender] > 0) {
            CollateralAmount = redeemCollateralBalances[msg.sender];
            redeemCollateralBalances[msg.sender] = 0;
            unclaimedPoolCollateral = unclaimedPoolCollateral.sub(CollateralAmount);

            sendCollateral = true;
        }

        if (sendFXS) {
            TransferHelper.safeTransfer(address(FXS), msg.sender, FXSAmount);
        }
        if (sendCollateral) {
            TransferHelper.safeTransfer(address(collateral_token), msg.sender, CollateralAmount);
        }
    }

    // Bypasses the gassy mint->redeem cycle for AMOs to borrow collateral
    function amoMinterBorrow(uint256 collateral_amount) external whenNotPaused onlyAMOMinters {
        // Transfer
        TransferHelper.safeTransfer(collateralAddress, msg.sender, collateral_amount);
    }

    // When the protocol is recollateralizing, we need to give a discount of FXS to hit the new CR target
    // Thus, if the target collateral ratio is higher than the actual value of collateral, minters get FXS for adding collateral
    // This function simply rewards anyone that sends collateral to a pool with the same amount of FXS + the bonus rate
    // Anyone can call this function to recollateralize the protocol and take the extra FXS value from the bonus rate as an arb opportunity
    function recollateralizeFRAX(uint256 collateral_amount, uint256 FXS_out_min) external {
        require(paused() == false, "Recollateralize is paused");
        uint256 collateral_amount_d18 = collateral_amount * (10 ** missing_decimals);
        uint256 fxs_price = FRAX.stockPrice();
        uint256 frax_total_supply = FRAX.totalSupply();
        uint256 globalCollateralRatio = FRAX.globalCollateralRatio();
        uint256 global_collat_value = FRAX.globalCollateralValue();

        (uint256 collateral_units, uint256 amount_to_recollat) = PoolLibrary.calcRecollateralizeStableInner(
            collateral_amount_d18,
            getCollateralPrice(),
            global_collat_value,
            frax_total_supply,
            globalCollateralRatio
        );

        uint256 collateral_units_precision = collateral_units.div(10 ** missing_decimals);

        uint256 fxs_paid_back = amount_to_recollat.mul(uint(1e6).add(bonus_rate).sub(recollat_fee)).div(fxs_price);

        require(FXS_out_min <= fxs_paid_back, "Slippage limit reached");
        TransferHelper.safeTransferFrom(address(collateral_token), msg.sender, address(this), collateral_units_precision);
        FXS.poolMint(msg.sender, fxs_paid_back);

    }

    // Function can be called by an FXS holder to have the protocol buy back FXS with excess collateral value from a desired collateral pool
    // This can also happen if the collateral ratio > 1
    function buyBackFXS(uint256 FXS_amount, uint256 COLLATERAL_out_min) external {
        require(paused() == false, "Buyback is paused");
        uint256 fxs_price = FRAX.stockPrice();

        PoolLibrary.BuybackStock_Params memory input_params = PoolLibrary.BuybackStock_Params(
            availableExcessCollatDV(),
            fxs_price,
            getCollateralPrice(),
            FXS_amount
        );

        (uint256 collateral_equivalent_d18) = (PoolLibrary.calcBuyBackStock(input_params)).mul(uint(1e6).sub(buyback_fee)).div(1e6);
        uint256 collateral_precision = collateral_equivalent_d18.div(10 ** missing_decimals);

        require(COLLATERAL_out_min <= collateral_precision, "Slippage limit reached");
        // Give the sender their desired collateral and burn the FXS
        FXS.poolBurnFrom(msg.sender, FXS_amount);
        TransferHelper.safeTransfer(address(collateral_token), msg.sender, collateral_precision);
    }

    // Combined into one function due to 24KiB contract memory limit
    function setPoolParameters(uint256 new_ceiling, uint256 new_bonus_rate, uint256 new_redemption_delay, uint256 new_mint_fee, uint256 new_redeem_fee, uint256 new_buyback_fee, uint256 new_recollat_fee) external onlyOwner {
        pool_ceiling = new_ceiling;
        bonus_rate = new_bonus_rate;
        redemption_delay = new_redemption_delay;
        minting_fee = new_mint_fee;
        redemption_fee = new_redeem_fee;
        buyback_fee = new_buyback_fee;
        recollat_fee = new_recollat_fee;

        emit PoolParametersSet(new_ceiling, new_bonus_rate, new_redemption_delay, new_mint_fee, new_redeem_fee, new_buyback_fee, new_recollat_fee);
    }

    event AMOMinterAdded(address amo_minter_addr);
    event AMOMinterRemoved(address amo_minter_addr);
    event PoolParametersSet(uint256 new_ceiling, uint256 new_bonus_rate, uint256 new_redemption_delay, uint256 new_mint_fee, uint256 new_redeem_fee, uint256 new_buyback_fee, uint256 new_recollat_fee);


}