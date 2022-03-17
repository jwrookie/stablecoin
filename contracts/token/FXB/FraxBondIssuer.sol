// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.6.11;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "../AbstractPausable.sol";
import '../../Math/Math.sol';
import "../Frax.sol";
import "./FXB.sol";

contract FraxBondIssuer is AbstractPausable {
    using SafeMath for uint256;

    /* ========== STATE VARIABLES ========== */
    enum DirectionChoice {BELOW_TO_PRICE_FRAX_IN, ABOVE_TO_PRICE}


    uint256 public constant ONE_YEAR = 1 * 365 * 86400;
    uint256 public constant PRICE_PRECISION = 1e6;
    uint256 private constant PRICE_PRECISION_SQUARED = 1e12;
    uint256 private constant PRICE_PRECISION_SQRT = 1e3;

    FRAXStablecoin public FRAX;
    FraxBond public FXB;

    uint256 public lastInterestTime;
    uint256 public exchangeRate;
    uint256 public interestRate;

    function calInterest() public {

        if (block.timestamp > lastInterestTime) {
            uint256 timePast = block.timestamp.sub(lastInterestTime);
            uint256 interest = interestRate.mul(timePast).div(ONE_YEAR).div(1e18);
            exchangeRate = exchangeRate.add(interest);
            lastInterestTime = block.timestamp;
        }
    }

    // Max FXB outstanding
    uint256 public maxFxbOutstanding = 1000000e18;

    // Target liquidity of FXB for the vAMM
    uint256 public targetLiquidityFxb = 500000e18;

    // Issuable FXB
    // This will be sold at the floor price until depleted, and bypass the vAMM
    uint256 public issuableFxb = 80000e18;
    uint256 public issuePrice = 750000;

    // Set fees, E6
    uint256 public issueFee = 500; // 0.05% initially
    uint256 public buyingFee = 1500; // 0.15% initially
    uint256 public sellingFee = 1500; // 0.15% initially
    uint256 public redemptionFee = 500; // 0.05% initially



    // Initial discount rates per epoch, in E6
    uint256 public initialDiscount = 200000; // 20% initially

    // Minimum collateral ratio
    uint256 public minCollateralRatio = 850000;


    // Virtual balances
    uint256 public vBalFarx;
    uint256 public vBalFxb;

    /* ========== CONSTRUCTOR ========== */

    constructor (
        address _frax_contract_address,
        address _fxb_contract_address
    ) {
        FRAX = FRAXStablecoin(_frax_contract_address);
        FXB = FraxBond(_fxb_contract_address);

    }

    /* ========== VIEWS ========== */



    // Needed for the Frax contract to function without bricking
    function collatDollarBalance() external pure returns (uint256) {
        return uint256(1e18);
        // 1 nonexistant USDC
    }

    // Liquidity balances for the floor price
    function getVirtualFloorLiquidityBalances() public view returns (uint256 frax_balance, uint256 fxb_balance) {
        frax_balance = targetLiquidityFxb.mul(floor_price()).div(PRICE_PRECISION);
        fxb_balance = targetLiquidityFxb;
    }

    // vAMM price for 1 FXB, in FRAX
    // The contract won't necessarily sell or buy at this price
    function amm_spot_price() public view returns (uint256 fxb_price) {
        fxb_price = vBalFarx.mul(PRICE_PRECISION).div(vBalFxb);
    }

    // FXB floor price for 1 FXB, in FRAX
    // Will be used to help prevent someone from doing a huge arb with cheap bonds right before they mature
    // Also allows the vAMM to buy back cheap FXB under the floor and retire it, meaning less to pay back later at face value
    function floor_price() public view returns (uint256 _floor_price) {
        //        uint256 time_into_epoch = (block.timestamp).sub(epoch_start);
        //        _floor_price = (PRICE_PRECISION.sub(initialDiscount)).add(initialDiscount.mul(time_into_epoch).div(epoch_length));
    }

    function initial_price() public view returns (uint256 _initial_price) {
        _initial_price = (PRICE_PRECISION.sub(initialDiscount));
    }

    // How much FRAX is needed to buy out the remaining unissued FXB
    function frax_to_buy_out_issue() public view returns (uint256 frax_value) {
        uint256 fxb_fee_amt = issuableFxb.mul(issueFee).div(PRICE_PRECISION);
        frax_value = (issuableFxb.add(fxb_fee_amt)).mul(issuePrice).div(PRICE_PRECISION);
    }



    /* ========== PUBLIC FUNCTIONS ========== */

    // Given an input amount of an asset and pair reserves, returns the maximum output amount of the other asset
    // Uses constant product concept https://uniswap.org/docs/v2/core-concepts/swaps/
    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut, uint the_fee) public pure returns (uint amountOut) {
        require(amountIn > 0, 'FraxBondIssuer: INSUFFICIENT_INPUT_AMOUNT');
        require(reserveIn > 0 && reserveOut > 0, 'FraxBondIssuer: INSUFFICIENT_LIQUIDITY');
        uint amountInWithFee = amountIn.mul(uint(PRICE_PRECISION).sub(the_fee));
        uint numerator = amountInWithFee.mul(reserveOut);
        uint denominator = (reserveIn.mul(PRICE_PRECISION)).add(amountInWithFee);
        amountOut = numerator.div(denominator);
    }

    function getAmountOutNoFee(uint amountIn, uint reserveIn, uint reserveOut) public pure returns (uint amountOut) {
        amountOut = getAmountOut(amountIn, reserveIn, reserveOut, 0);
    }

    function buyUnissuedFXB(uint256 frax_in, uint256 fxb_out_min) public whenNotPaused returns (uint256 fxb_out, uint256 fxb_fee_amt) {
        require(issuableFxb > 0, 'No new FXB to issue');
        require(FRAX.fraxPrice() < PRICE_PRECISION, "FRAX price must be less than $1");
        require(FRAX.globalCollateralRatio() >= minCollateralRatio, "FRAX is already too undercollateralized");

        // Issue at the issue_price or the floor_price, whichever is higher
        uint256 price_to_use = issuePrice;
        {
            uint256 the_floor_price = floor_price();
            if (the_floor_price > issuePrice) {
                price_to_use = the_floor_price;
            }
        }

        // Get the expected amount of FXB from the floor-priced portion
        fxb_out = frax_in.mul(PRICE_PRECISION).div(price_to_use);

        // Calculate and apply the normal buying fee
        fxb_fee_amt = fxb_out.mul(issueFee).div(PRICE_PRECISION);

        // Apply the fee
        fxb_out = fxb_out.sub(fxb_fee_amt);

        // Check fxb_out_min
        require(fxb_out >= fxb_out_min, "[buyUnissuedFXB fxb_out_min]: Slippage limit reached");

        // Check the limit
        require(fxb_out <= issuableFxb, 'Trying to buy too many unissued bonds');

        // Safety check
        require(((FXB.totalSupply()).add(fxb_out)) <= maxFxbOutstanding, "New issue would exceed max_fxb_outstanding");

        // Decrement the unissued amount
        issuableFxb = issuableFxb.sub(fxb_out);

        // Zero out precision-related crumbs if less than 1 FXB left 
        if (issuableFxb < uint256(1e18)) {
            issuableFxb = 0;
        }

        // Burn FRAX from the sender. No vAMM balance change here
        FRAX.poolBurnFrom(msg.sender, frax_in);

        // Mint FXB to the sender. No vAMM balance change here
        FXB.issuer_mint(msg.sender, fxb_out);
    }


    function mintBond(uint256 fraxIn) external whenNotPaused returns (uint256 fxbOut, uint256 fraxFee) {
        FRAX.poolBurnFrom(msg.sender, fraxIn);
        fraxFee = fraxIn.mul(issueFee).div(PRICE_PRECISION);
        fxbOut = fraxIn.mul(1e18).div(exchangeRate);
        FXB.issuer_mint(msg.sender, fxbOut);
        emit BondMint(msg.sender, fraxIn, fxbOut);
    }

    function redeemBond(uint256 fxbIn) external whenNotPaused returns (uint256 fraxOut, uint256 fraxFee) {
        // Burn FXB from the sender
        FXB.burnFrom(msg.sender, fxbIn);
        fraxOut = fxbIn.mul(exchangeRate).div(1e18);
        fraxFee = fraxOut.mul(redemptionFee).div(PRICE_PRECISION);
        FRAX.poolMint(msg.sender, fraxOut);
        emit BondRedeemed(msg.sender, fxbIn, fraxOut);
    }

    /* ========== RESTRICTED INTERNAL FUNCTIONS ========== */

    function _rebalance_AMM_FRAX_to_price(uint256 rebalance_price) internal {
        // Safety checks
        require(rebalance_price <= PRICE_PRECISION, "Rebalance price too high");
        require(rebalance_price >= (PRICE_PRECISION.sub(initialDiscount)), "Rebalance price too low");

        uint256 frax_required = targetLiquidityFxb.mul(rebalance_price).div(PRICE_PRECISION);
        if (frax_required > vBalFarx) {
            // Virtually add the deficiency
            vBalFarx = vBalFarx.add(frax_required.sub(vBalFarx));
        }
        else if (frax_required < vBalFarx) {
            // Virtually subtract the excess
            vBalFarx = vBalFarx.sub(vBalFarx.sub(frax_required));
        }
        else if (frax_required == vBalFarx) {
            // Do nothing
        }
    }

    function _rebalance_AMM_FXB() internal {
        uint256 fxb_required = targetLiquidityFxb;
        if (fxb_required > vBalFxb) {
            // Virtually add the deficiency
            vBalFxb = vBalFxb.add(fxb_required.sub(vBalFxb));
        }
        else if (fxb_required < vBalFxb) {
            // Virtually subtract the excess
            vBalFxb = vBalFxb.sub(vBalFxb.sub(fxb_required));
        }
        else if (fxb_required == vBalFxb) {
            // Do nothing
        }

        // Quick safety check
        require(((FXB.totalSupply()).add(issuableFxb)) <= maxFxbOutstanding, "Rebalance would exceed max_fxb_outstanding");
    }

    function getBoundedIn(DirectionChoice choice, uint256 the_price) internal view returns (uint256 bounded_amount) {
        if (choice == DirectionChoice.BELOW_TO_PRICE_FRAX_IN) {
            uint256 numerator = Math.sqrt(vBalFarx).mul(Math.sqrt(vBalFxb)).mul(PRICE_PRECISION_SQRT);
            // The "price" here needs to be inverted 
            uint256 denominator = Math.sqrt((PRICE_PRECISION_SQUARED).div(the_price));
            bounded_amount = numerator.div(denominator).sub(vBalFarx);
        }
        else if (choice == DirectionChoice.ABOVE_TO_PRICE) {
            uint256 numerator = Math.sqrt(vBalFarx).mul(Math.sqrt(vBalFxb)).mul(PRICE_PRECISION_SQRT);
            uint256 denominator = Math.sqrt(the_price);
            bounded_amount = numerator.div(denominator).sub(vBalFxb);
        }
    }

    /* ========== RESTRICTED EXTERNAL FUNCTIONS ========== */

    // Allows for expanding the liquidity mid-epoch
    // The expansion must occur at the current vAMM price
    function expand_AMM_liquidity(uint256 fxb_expansion_amount, bool do_rebalance) external onlyOwner {
        require(FRAX.globalCollateralRatio() >= minCollateralRatio, "FRAX is already too undercollateralized");

        // Expand the FXB target liquidity
        targetLiquidityFxb = targetLiquidityFxb.add(fxb_expansion_amount);

        // Optionally do the rebalance. If not, it will be done at an applicable time in one of the buy / sell functions
        if (do_rebalance) {
            rebalance_AMM_liquidity_to_price(amm_spot_price());
        }
    }

    // Allows for contracting the liquidity mid-epoch
    // The expansion must occur at the current vAMM price
    function contract_AMM_liquidity(uint256 fxb_contraction_amount, bool do_rebalance) external onlyOwner {
        // Expand the FXB target liquidity
        targetLiquidityFxb = targetLiquidityFxb.sub(fxb_contraction_amount);

        // Optionally do the rebalance. If not, it will be done at an applicable time in one of the buy / sell functions
        if (do_rebalance) {
            rebalance_AMM_liquidity_to_price(amm_spot_price());
        }
    }

    // Rebalance vAMM to a desired price
    function rebalance_AMM_liquidity_to_price(uint256 rebalance_price) public onlyOwner {
        // Rebalance the FXB
        _rebalance_AMM_FXB();

        // Rebalance the FRAX
        _rebalance_AMM_FRAX_to_price(rebalance_price);
    }

    function setMaxFXBOutstanding(uint256 _max_fxb_outstanding) external onlyOwner {
        maxFxbOutstanding = _max_fxb_outstanding;
    }

    function setTargetLiquidity(uint256 _target_liquidity_fxb, bool _rebalance_vAMM) external onlyOwner {
        targetLiquidityFxb = _target_liquidity_fxb;
        if (_rebalance_vAMM) {
            rebalance_AMM_liquidity_to_price(amm_spot_price());
        }
    }

    function clearIssuableFXB() external onlyOwner {
        issuableFxb = 0;
        issuePrice = PRICE_PRECISION;
    }

    function setIssuableFXB(uint256 _issuable_fxb, uint256 _issue_price) external onlyOwner {
        if (_issuable_fxb > issuableFxb) {
            require(((FXB.totalSupply()).add(_issuable_fxb)) <= maxFxbOutstanding, "New issue would exceed max_fxb_outstanding");
        }
        issuableFxb = _issuable_fxb;
        issuePrice = _issue_price;
    }

    function setFees(uint256 _issue_fee, uint256 _buying_fee, uint256 _selling_fee, uint256 _redemption_fee) external onlyOwner {
        issueFee = _issue_fee;
        buyingFee = _buying_fee;
        sellingFee = _selling_fee;
        redemptionFee = _redemption_fee;
    }

    function setMinCollateralRatio(uint256 _min_collateral_ratio) external onlyOwner {
        minCollateralRatio = _min_collateral_ratio;
    }

    function setInitialDiscount(uint256 _initial_discount, bool _rebalance_AMM) external onlyOwner {
        initialDiscount = _initial_discount;
        if (_rebalance_AMM) {
            rebalance_AMM_liquidity_to_price(PRICE_PRECISION.sub(initialDiscount));
        }
    }


    function emergencyRecoverERC20(address destination_address, address tokenAddress, uint256 tokenAmount) external onlyOwner {
        ERC20(tokenAddress).transfer(destination_address, tokenAmount);
        emit Recovered(tokenAddress, destination_address, tokenAmount);
    }

    /* ========== EVENTS ========== */

    event Recovered(address token, address to, uint256 amount);

    // Track bond redeeming
    event BondRedeemed(address indexed from, uint256 fxb_amount, uint256 frax_out);
    event BondMint(address indexed from, uint256 frax_amount, uint256 fxb_out);
    //    event FXB_Redeemed(address indexed from, uint256 fxb_amount, uint256 frax_out);
}


