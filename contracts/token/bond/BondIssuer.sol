// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "../../tools/AbstractPausable.sol";
import '../../math/Math.sol';
import "../Rusd.sol";
import "./Bond.sol";

contract BondIssuer is AbstractPausable {
    using SafeMath for uint256;

    uint256 public constant ONE_YEAR = 1 * 365 * 86400;
    uint256 public constant PRICE_PRECISION = 1e6;

    RStablecoin public stableCoin;
    Bond public bond;

    uint256 public lastInterestTime;
    uint256 public exchangeRate;
    uint256 public interestRate;
    uint256 public minInterestRate;
    uint256 public maxInterestRate;

    uint256 public maxBondOutstanding = 1000000e18;


    // Set fees, E6
    uint256 public issueFee = 100; // 0.01% initially
    uint256 public redemptionFee = 100; // 0.01% initially
    uint256 public fee;


    // Virtual balances
    uint256 public vBalStable;

    /* ========== CONSTRUCTOR ========== */

    constructor (
        address _operatorMsg,
        address _frax_contract_address,
        address _fxb_contract_address
    ) AbstractPausable(_operatorMsg){
        stableCoin = RStablecoin(_frax_contract_address);
        bond = Bond(_fxb_contract_address);
        minInterestRate = 1e16;
        maxInterestRate = 3e16;
        interestRate = 1e16;
        exchangeRate = 1e18;
        TransferHelper.safeApprove(address(stableCoin), address(this), type(uint256).max);
        TransferHelper.safeApprove(address(bond), address(bond), type(uint256).max);

    }

    function currentInterestRate() public view returns (uint256){
        uint256 totalSupply = IERC20(bond).totalSupply();
        if (totalSupply <= maxBondOutstanding) {
            return interestRate;
        } else {
            return interestRate.mul(maxBondOutstanding).div(totalSupply);
        }
    }

    function collatDollarBalance() external pure returns (uint256) {
        return uint256(1e18);

    }

    function calInterest() public {
        if (block.timestamp > lastInterestTime) {
            uint256 timePast = block.timestamp.sub(lastInterestTime);
            uint256 interest = currentInterestRate().mul(timePast).div(ONE_YEAR);
            exchangeRate = exchangeRate.add(interest);
            lastInterestTime = block.timestamp;
        }
    }

    function mintBond(uint256 fraxIn) external whenNotPaused returns (uint256 fxbOut, uint256 fraxFee) {
        calInterest();
        TransferHelper.safeTransferFrom(address(stableCoin), msg.sender, address(this), fraxIn);

        fraxFee = fraxIn.mul(issueFee).div(PRICE_PRECISION);
        fee = fee.add(fraxFee);

        uint amount = fraxIn.sub(fraxFee);
        stableCoin.poolBurn(msg.sender, amount);

        fxbOut = fraxIn.mul(1e18).div(exchangeRate);
        bond.issuer_mint(msg.sender, fxbOut);
        vBalStable = vBalStable.add(fraxIn);
        emit BondMint(msg.sender, fraxIn, fxbOut, fraxFee);
    }

    function redeemBond(uint256 fxbIn) external whenNotPaused returns (uint256 fraxOut, uint256 fraxFee) {
        calInterest();
        bond.burnFrom(msg.sender, fxbIn);
        fraxOut = fxbIn.mul(exchangeRate).div(1e18);
        fraxFee = fraxOut.mul(redemptionFee).div(PRICE_PRECISION);
        fee = fee.add(fraxFee);
        stableCoin.poolMint(address(this), fraxOut);
        TransferHelper.safeTransfer(address(stableCoin), msg.sender, fraxOut.sub(fraxFee));
        vBalStable = vBalStable.sub(fraxOut);
        emit BondRedeemed(msg.sender, fxbIn, fraxOut, fraxFee);
    }

    function setMaxBondOutstanding(uint256 _max) external onlyOwner {
        maxBondOutstanding = _max;
    }

    function setRangeInterestRate(uint256 min, uint256 max) external onlyOwner {
        minInterestRate = min;
        maxInterestRate = max;
    }

    function setInterestRate(uint256 _interestRate) external onlyOwner {
        require(maxInterestRate >= _interestRate && _interestRate >= minInterestRate, "rate  in range");
        interestRate = _interestRate;
    }

    function setFees(uint256 _issue_fee, uint256 _redemption_fee) external onlyOwner {
        issueFee = _issue_fee;
        redemptionFee = _redemption_fee;
    }

    function claimFee() external onlyOwner {
        TransferHelper.safeTransfer(address(stableCoin), msg.sender, fee);
        fee = 0;
    }

    function recoverToken(address token, uint256 amount) external onlyOwner {
        ERC20(token).transfer(msg.sender, amount);
        emit Recovered(token, msg.sender, amount);
    }


    event Recovered(address token, address to, uint256 amount);

    // Track bond redeeming
    event BondRedeemed(address indexed from, uint256 fxb_amount, uint256 frax_out, uint256 fee);
    event BondMint(address indexed from, uint256 frax_amount, uint256 fxb_out, uint256 fee);

}


