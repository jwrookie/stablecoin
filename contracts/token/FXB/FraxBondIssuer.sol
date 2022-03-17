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



    // Max FXB outstanding
    uint256 public maxFxbOutstanding = 1000000e18;


    // Set fees, E6
    uint256 public issueFee = 500; // 0.05% initially
    uint256 public redemptionFee = 500; // 0.05% initially


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

    function calInterest() public {
        if (block.timestamp > lastInterestTime) {
            uint256 timePast = block.timestamp.sub(lastInterestTime);
            uint256 interest = interestRate.mul(timePast).div(ONE_YEAR).div(1e18);
            exchangeRate = exchangeRate.add(interest);
            lastInterestTime = block.timestamp;
        }
    }

    function mintBond(uint256 fraxIn) external whenNotPaused returns (uint256 fxbOut, uint256 fraxFee) {
        calInterest();
        FRAX.poolBurnFrom(msg.sender, fraxIn);
        fraxFee = fraxIn.mul(issueFee).div(PRICE_PRECISION);
        fxbOut = fraxIn.mul(1e18).div(exchangeRate);
        FXB.issuer_mint(msg.sender, fxbOut);
        emit BondMint(msg.sender, fraxIn, fxbOut);
    }

    function redeemBond(uint256 fxbIn) external whenNotPaused returns (uint256 fraxOut, uint256 fraxFee) {
        calInterest();
        FXB.burnFrom(msg.sender, fxbIn);
        fraxOut = fxbIn.mul(exchangeRate).div(1e18);
        fraxFee = fraxOut.mul(redemptionFee).div(PRICE_PRECISION);
        FRAX.poolMint(msg.sender, fraxOut);
        emit BondRedeemed(msg.sender, fxbIn, fraxOut);
    }

    function setFees(uint256 _issue_fee, uint256 _redemption_fee) external onlyOwner {
        issueFee = _issue_fee;
        redemptionFee = _redemption_fee;
    }


    function recoverToken(address token, uint256 amount) external onlyOwner {
        ERC20(token).transfer(msg.sender, amount);
        emit Recovered(token, msg.sender, amount);
    }


    event Recovered(address token, address to, uint256 amount);

    // Track bond redeeming
    event BondRedeemed(address indexed from, uint256 fxb_amount, uint256 frax_out);
    event BondMint(address indexed from, uint256 frax_amount, uint256 fxb_out);

}


