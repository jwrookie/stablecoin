// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "../tools/TransferHelper.sol";
import "../interface/IAMO.sol";
import "../tools/CheckPermission.sol";
import "../interface/IStablecoinPool.sol";
import "../interface/IStablecoin.sol";
import "../interface/IStock.sol";

contract AMOMinter is CheckPermission {
    uint256 private constant PRICE_PRECISION = 1e6;

    IStablecoin public immutable stablecoin;
    IStock public immutable stock;
    ERC20 public immutable collateralToken;
    IStablecoinPool public pool;

    address[] public amosArray;
    mapping(address => bool) public amos; // Mapping is also used for faster verification

    uint256 public collatBorrowCap = 10000000e6;

    uint256 public stableCoinMintCap = 100000000e18;
    uint256 public fxsMintCap = 100000000e18;

    // Minimum collateral ratio needed for new FRAX minting
    uint256 public minCR = 950000;

    mapping(address => uint256) public stableMintBalances;
    uint256 public stableMintSum;

    mapping(address => uint256) public stockMintBalances;
    uint256 public stockMintSum = 0; // Across all AMOs

    // Collateral borrowed balances
    mapping(address => uint256) public collatBorrowedBalances; // Amount of collateral the contract borrowed, by AMO
    uint256 public collatBorrowedSum = 0; // Across all AMOs

    uint256 public stableDollarBalanceStored = 0;

    // Collateral balance related
    uint256 public missingDecimals;
    uint256 public collatDollarBalanceStored = 0;

    // AMO balance corrections
    mapping(address => uint256[2]) public correctionOffsetsAmos;

    constructor(
        address _operatorMsg,
        address _custodian_address,
        address _stableAddress,
        address _stockAddress,
        address _collateral_address,
        address _pool_address
    ) CheckPermission(_operatorMsg) {
        stablecoin = IStablecoin(_stableAddress);
        stock = IStock(_stockAddress);
        pool = IStablecoinPool(_pool_address);
        collateralToken = ERC20(_collateral_address);
        missingDecimals = uint256(18) - collateralToken.decimals();
    }

    modifier validAMO(address amo_address) {
        require(amos[amo_address], "Invalid AMO");
        _;
    }

    function collatDollarBalance() external view returns (uint256) {
        (, uint256 collatValE18) = dollarBalances();
        return collatValE18;
    }

    function dollarBalances() public view returns (uint256 stableValE18, uint256 collatValE18) {
        stableValE18 = stableDollarBalanceStored;
        collatValE18 = collatDollarBalanceStored;
    }

    function allAMOsLength() external view returns (uint256) {
        return amosArray.length;
    }

    function stableTrackedGlobal() external view returns (uint256) {
        return stableDollarBalanceStored - stableMintSum - (collatBorrowedSum * (10**missingDecimals));
    }

    function stableTrackedAMO(address amo_address) external view returns (uint256) {
        (uint256 fraxValE18, ) = IAMO(amo_address).dollarBalances();
        uint256 stableValE18Corrected = fraxValE18 + correctionOffsetsAmos[amo_address][0];
        return
            stableValE18Corrected -
            stableMintBalances[amo_address] -
            ((collatBorrowedBalances[amo_address]) * (10**missingDecimals));
    }

    // Callable by anyone willing to pay the gas
    function syncDollarBalances() public {
        uint256 totalStableValueD18 = 0;
        uint256 totalCollateralValueD18 = 0;
        for (uint256 i = 0; i < amosArray.length; i++) {
            // Exclude null addresses
            address amo_address = amosArray[i];
            if (amo_address != address(0)) {
                (uint256 stableValE18, uint256 collatValE18) = IAMO(amo_address).dollarBalances();
                totalStableValueD18 += stableValE18 + correctionOffsetsAmos[amo_address][0];
                totalCollateralValueD18 += collatValE18 + correctionOffsetsAmos[amo_address][1];
            }
        }
        stableDollarBalanceStored = totalStableValueD18;
        collatDollarBalanceStored = totalCollateralValueD18;
    }

    function poolRedeem(uint256 _amount) external onlyOperator {
        uint256 redemptionFee = pool.redemption_fee();
        uint256 colPriceUsd = pool.getCollateralPrice();

        uint256 globalCollateralRatio = stablecoin.globalCollateralRatio();

        uint256 redeemAmountE6 = ((_amount * (uint256(1e6) - redemptionFee)) / 1e6) / (10**missingDecimals);
        uint256 expectedCollatAmount = (redeemAmountE6 * globalCollateralRatio) / 1e6;
        expectedCollatAmount = (expectedCollatAmount * 1e6) / colPriceUsd;

        require((collatBorrowedSum + expectedCollatAmount) <= collatBorrowCap, "Borrow cap");
        collatBorrowedSum += expectedCollatAmount;

        // Mint the stablecoin
        stablecoin.poolMint(address(this), _amount);

        // Redeem the stablecoin
        stablecoin.approve(address(pool), _amount);
        pool.redeemFractionalFRAX(_amount, 0, 0);
    }

    function poolCollectAndGive(address destinationAmo) external onlyOperator validAMO(destinationAmo) {
        // Get the amount to be collected
        uint256 collatAmount = pool.redeemCollateralBalances(address(this));

        // Collect the redemption
        pool.collectRedemption();

        // Mark the destination amo's borrowed amount
        collatBorrowedBalances[destinationAmo] += collatAmount;

        // Give the collateral to the AMO
        TransferHelper.safeTransfer(address(collateralToken), destinationAmo, collatAmount);

        // Sync
        syncDollarBalances();
    }

    // This contract is essentially marked as a 'pool' so it can call OnlyPools functions like poolMint and poolBurnFrom
    // on the main stable contract
    function mintStableForAMO(address destinationAmo, uint256 stableAmount)
        external
        onlyOperator
        validAMO(destinationAmo)
    {
        // Make sure you aren't minting more than the mint cap
        require((stableMintSum + stableAmount) <= stableCoinMintCap, "Mint cap reached");
        stableMintBalances[destinationAmo] += stableAmount;
        stableMintSum += stableAmount;

        // Make sure the FRAX minting wouldn't push the CR down too much
        // This is also a sanity check for the int256 math
        uint256 currentCollateralE18 = stablecoin.globalCollateralValue();
        uint256 curFraxSupply = stablecoin.totalSupply();
        uint256 newStableSupply = curFraxSupply + stableAmount;
        uint256 newCR = (currentCollateralE18 * PRICE_PRECISION) / newStableSupply;
        require(newCR >= minCR, "CR would be too low");

        // Mint the FRAX to the AMO
        stablecoin.poolMint(destinationAmo, stableAmount);

        // Sync
        syncDollarBalances();
    }

    function burnStableFromAMO(uint256 _amount) external validAMO(msg.sender) {
        // Burn first
        stablecoin.poolBurnFrom(msg.sender, _amount);

        // Then update the balances
        stableMintBalances[msg.sender] -= _amount;
        stableMintSum -= _amount;

        // Sync
        syncDollarBalances();
    }

    function mintStockForAMO(address destinationAmo, uint256 _amount) external onlyOperator validAMO(destinationAmo) {
        // Make sure you aren't minting more than the mint cap
        require((stockMintSum + _amount) <= fxsMintCap, "Mint cap reached");
        stockMintBalances[destinationAmo] += _amount;
        stockMintSum += _amount;

        // Mint the FXS to the AMO
        stock.poolMint(destinationAmo, _amount);

        // Sync
        syncDollarBalances();
    }

    function burnStockFromAMO(uint256 _amount) external validAMO(msg.sender) {
        // Burn first
        stock.poolBurnFrom(msg.sender, _amount);

        // Then update the balances
        stockMintBalances[msg.sender] -= _amount;
        stockMintSum -= _amount;

        // Sync
        syncDollarBalances();
    }

    // ------------------------------------------------------------------
    // --------------------------- Collateral ---------------------------
    // ------------------------------------------------------------------

    function giveCollatToAMO(address destinationAmo, uint256 _amount) external onlyOperator validAMO(destinationAmo) {
        require((collatBorrowedSum + _amount) <= collatBorrowCap, "Borrow cap");
        collatBorrowedBalances[destinationAmo] += _amount;
        collatBorrowedSum += _amount;

        // Borrow the collateral
        pool.amoMinterBorrow(_amount);

        // Give the collateral to the AMO
        TransferHelper.safeTransfer(address(collateralToken), destinationAmo, _amount);

        // Sync
        syncDollarBalances();
    }

    function receiveCollatFromAMO(uint256 _amount) external validAMO(msg.sender) {
        // Give back first
        TransferHelper.safeTransferFrom(address(collateralToken), msg.sender, address(pool), _amount);

        // Then update the balances
        collatBorrowedBalances[msg.sender] -= _amount;
        collatBorrowedSum -= _amount;

        // Sync
        syncDollarBalances();
    }

    // Adds an AMO
    function addAMO(address amoAddress, bool _sync) public onlyOperator {
        require(amoAddress != address(0), "Zero address detected");

        (uint256 stableValE18, uint256 collatValE18) = IAMO(amoAddress).dollarBalances();
        require(stableValE18 >= 0 && collatValE18 >= 0, "Invalid AMO");

        require(amos[amoAddress] == false, "Address already exists");
        amos[amoAddress] = true;
        amosArray.push(amoAddress);

        // Mint balances
        stableMintBalances[amoAddress] = 0;
        stockMintBalances[amoAddress] = 0;
        collatBorrowedBalances[amoAddress] = 0;

        // Offsets
        correctionOffsetsAmos[amoAddress][0] = 0;
        correctionOffsetsAmos[amoAddress][1] = 0;

        if (_sync) syncDollarBalances();

        emit AMOAdded(amoAddress);
    }

    // Removes an AMO
    function removeAMO(address amoAddress, bool _sync) public onlyOperator {
        require(amoAddress != address(0), "Zero address detected");
        require(amos[amoAddress] == true, "Address no exist");

        // Delete from the mapping
        delete amos[amoAddress];

        // 'Delete' from the array by setting the address to 0x0
        for (uint256 i = 0; i < amosArray.length; i++) {
            if (amosArray[i] == amoAddress) {
                amosArray[i] = address(0);
                // This will leave a null in the array and keep the indices the same
                break;
            }
        }

        if (_sync) syncDollarBalances();

        emit AMORemoved(amoAddress);
    }

    function setStableMintCap(uint256 _stableMintCap) external onlyOperator {
        stableCoinMintCap = _stableMintCap;
    }

    function setStockMintCap(uint256 _stockMintCap) external onlyOperator {
        fxsMintCap = _stockMintCap;
    }

    function setCollatBorrowCap(uint256 _collatBorrowCap) external onlyOperator {
        collatBorrowCap = _collatBorrowCap;
    }

    function setMinimumCollateralRatio(uint256 _minCR) external onlyOperator {
        minCR = _minCR;
    }

    function setAMOCorrectionOffsets(
        address amoAddress,
        uint256 fraxE18Correction,
        uint256 collatE18Correction
    ) external onlyOperator {
        correctionOffsetsAmos[amoAddress][0] = fraxE18Correction;
        correctionOffsetsAmos[amoAddress][1] = collatE18Correction;

        syncDollarBalances();
    }

    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOperator {
        // Can only be triggered by owner or governance
        TransferHelper.safeTransfer(tokenAddress, owner(), tokenAmount);

        emit Recovered(tokenAddress, tokenAmount);
    }

    // Generic proxy
    function execute(
        address _to,
        uint256 _value,
        bytes calldata _data
    ) external onlyOperator returns (bool, bytes memory) {
        (bool success, bytes memory result) = _to.call{value: _value}(_data);
        return (success, result);
    }

    event AMOAdded(address amo_address);
    event AMORemoved(address amo_address);
    event Recovered(address token, uint256 amount);
}
