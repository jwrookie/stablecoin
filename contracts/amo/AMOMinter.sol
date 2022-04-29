// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import '../tools/TransferHelper.sol';
import '../interface/IAMO.sol';
import "../tools/CheckPermission.sol";
import "../interface/IStablecoinPool.sol";
import "../interface/IStablecoin.sol";
import "../interface/IStock.sol";

contract AMOMinter is CheckPermission {

    uint256 private constant PRICE_PRECISION = 1e6;

    IStablecoin public immutable stablecoin;
    IStock public immutable stock;
    ERC20 public immutable collateralToken;
    IStablecoinPool public  pool;

    address public collateralAddress;
    address[] public amosArray;
    mapping(address => bool) public amos; // Mapping is also used for faster verification



    int256 public collatBorrowCap = int256(10000000e6);


    int256 public stableCoinMintCap = int256(100000000e18);
    int256 public fxsMintCap = int256(100000000e18);

    // Minimum collateral ratio needed for new FRAX minting
    uint256 public minCR = 810000;

    mapping(address => int256) public stablecoinMintBalances;
    int256 public stableCoinMintSum;

    mapping(address => int256) public stockMintBalances;
    int256 public stockMintSum = 0; // Across all AMOs

    // Collateral borrowed balances
    mapping(address => int256) public collatBorrowedBalances; // Amount of collateral the contract borrowed, by AMO
    int256 public collatBorrowedSum = 0; // Across all AMOs


    uint256 public stableDollarBalanceStored = 0;

    // Collateral balance related
    uint256 public missingDecimals;
    uint256 public collatDollarBalanceStored = 0;

    // AMO balance corrections
    mapping(address => int256[2]) public correctionOffsetsAmos;


    constructor (
        address _operatorMsg,
        address _custodian_address,
        address _stableAddress,
        address _stockAddress,
        address _collateral_address,
        address _pool_address
    ) CheckPermission(_operatorMsg) {

        stablecoin = IStablecoin(_stableAddress);
        stock = IStock(_stockAddress);
        // Pool related
        pool = IStablecoinPool(_pool_address);

        // Collateral related
        collateralAddress = _collateral_address;
        //        col_idx = pool.collateralAddrToIdx(_collateral_address);
        collateralToken = ERC20(_collateral_address);
        missingDecimals = uint(18) - collateralToken.decimals();
    }

    modifier validAMO(address amo_address) {
        require(amos[amo_address], "Invalid AMO");
        _;
    }


    function collatDollarBalance() external view returns (uint256) {
        (, uint256 collat_val_e18) = dollarBalances();
        return collat_val_e18;
    }

    function dollarBalances() public view returns (uint256 frax_val_e18, uint256 collat_val_e18) {
        frax_val_e18 = stableDollarBalanceStored;
        collat_val_e18 = collatDollarBalanceStored;
    }

    function allAMOAddresses() external view returns (address[] memory) {
        return amosArray;
    }

    function allAMOsLength() external view returns (uint256) {
        return amosArray.length;
    }

    function fraxTrackedGlobal() external view returns (int256) {
        return int256(stableDollarBalanceStored) - stableCoinMintSum - (collatBorrowedSum * int256(10 ** missingDecimals));
    }

    function fraxTrackedAMO(address amo_address) external view returns (int256) {
        (uint256 frax_val_e18,) = IAMO(amo_address).dollarBalances();
        int256 frax_val_e18_corrected = int256(frax_val_e18) + correctionOffsetsAmos[amo_address][0];
        return frax_val_e18_corrected - stablecoinMintBalances[amo_address] - ((collatBorrowedBalances[amo_address]) * int256(10 ** missingDecimals));
    }

    /* ========== PUBLIC FUNCTIONS ========== */

    // Callable by anyone willing to pay the gas
    function syncDollarBalances() public {
        uint256 total_frax_value_d18 = 0;
        uint256 total_collateral_value_d18 = 0;
        for (uint i = 0; i < amosArray.length; i++) {
            // Exclude null addresses
            address amo_address = amosArray[i];
            if (amo_address != address(0)) {
                (uint256 frax_val_e18, uint256 collat_val_e18) = IAMO(amo_address).dollarBalances();
                total_frax_value_d18 += uint256(int256(frax_val_e18) + correctionOffsetsAmos[amo_address][0]);
                total_collateral_value_d18 += uint256(int256(collat_val_e18) + correctionOffsetsAmos[amo_address][1]);
            }
        }
        stableDollarBalanceStored = total_frax_value_d18;
        collatDollarBalanceStored = total_collateral_value_d18;
    }

    /* ========== OLD POOL / BACKWARDS COMPATIBILITY ========== */

    function oldPoolRedeem(uint256 frax_amount) external onlyOperator {
        uint256 redemption_fee = pool.redemption_fee();
        uint256 col_price_usd = pool.getCollateralPrice();
        uint256 globalCollateralRatio = stablecoin.globalCollateralRatio();
        uint256 redeem_amount_E6 = ((frax_amount * (uint256(1e6) - redemption_fee)) / 1e6) / (10 ** missingDecimals);
        uint256 expected_collat_amount = (redeem_amount_E6 * globalCollateralRatio) / 1e6;
        expected_collat_amount = (expected_collat_amount * 1e6) / col_price_usd;

        require((collatBorrowedSum + int256(expected_collat_amount)) <= collatBorrowCap, "Borrow cap");
        collatBorrowedSum += int256(expected_collat_amount);

        // Mint the frax 
        stablecoin.poolMint(address(this), frax_amount);

        // Redeem the frax
        stablecoin.approve(address(pool), frax_amount);
        pool.redeemFractionalFRAX(frax_amount, 0, 0);
    }

    function oldPoolCollectAndGive(address destination_amo) external onlyOperator validAMO(destination_amo) {
        // Get the amount to be collected
        uint256 collat_amount = pool.redeemCollateralBalances(address(this));

        // Collect the redemption
        pool.collectRedemption();

        // Mark the destination amo's borrowed amount
        collatBorrowedBalances[destination_amo] += int256(collat_amount);

        // Give the collateral to the AMO
        TransferHelper.safeTransfer(collateralAddress, destination_amo, collat_amount);

        // Sync
        syncDollarBalances();
    }

    /* ========== OWNER / GOVERNANCE FUNCTIONS ONLY ========== */
    // Only owner or timelock can call, to limit risk 

    // ------------------------------------------------------------------
    // ------------------------------ FRAX ------------------------------
    // ------------------------------------------------------------------

    // This contract is essentially marked as a 'pool' so it can call OnlyPools functions like poolMint and poolBurnFrom
    // on the main FRAX contract
    function mintFraxForAMO(address destination_amo, uint256 frax_amount) external onlyOperator validAMO(destination_amo) {
        int256 frax_amt_i256 = int256(frax_amount);

        // Make sure you aren't minting more than the mint cap
        require((stableCoinMintSum + frax_amt_i256) <= stableCoinMintCap, "Mint cap reached");
        stablecoinMintBalances[destination_amo] += frax_amt_i256;
        stableCoinMintSum += frax_amt_i256;

        // Make sure the FRAX minting wouldn't push the CR down too much
        // This is also a sanity check for the int256 math
        uint256 current_collateral_E18 = stablecoin.globalCollateralValue();
        uint256 cur_frax_supply = stablecoin.totalSupply();
        uint256 new_frax_supply = cur_frax_supply + frax_amount;
        uint256 new_cr = (current_collateral_E18 * PRICE_PRECISION) / new_frax_supply;
        require(new_cr >= minCR, "CR would be too low");

        // Mint the FRAX to the AMO
        stablecoin.poolMint(destination_amo, frax_amount);

        // Sync
        syncDollarBalances();
    }

    function burnFraxFromAMO(uint256 frax_amount) external validAMO(msg.sender) {
        int256 frax_amt_i256 = int256(frax_amount);

        // Burn first
        stablecoin.poolBurnFrom(msg.sender, frax_amount);

        // Then update the balances
        stablecoinMintBalances[msg.sender] -= frax_amt_i256;
        stableCoinMintSum -= frax_amt_i256;

        // Sync
        syncDollarBalances();
    }

    // ------------------------------------------------------------------
    // ------------------------------- FXS ------------------------------
    // ------------------------------------------------------------------

    function mintFxsForAMO(address destination_amo, uint256 fxs_amount) external onlyOperator validAMO(destination_amo) {
        int256 fxs_amt_i256 = int256(fxs_amount);

        // Make sure you aren't minting more than the mint cap
        require((stockMintSum + fxs_amt_i256) <= fxsMintCap, "Mint cap reached");
        stockMintBalances[destination_amo] += fxs_amt_i256;
        stockMintSum += fxs_amt_i256;

        // Mint the FXS to the AMO
        stock.poolMint(destination_amo, fxs_amount);

        // Sync
        syncDollarBalances();
    }

    function burnFxsFromAMO(uint256 fxs_amount) external validAMO(msg.sender) {
        int256 fxs_amt_i256 = int256(fxs_amount);

        // Burn first
        stock.poolBurnFrom(msg.sender, fxs_amount);

        // Then update the balances
        stockMintBalances[msg.sender] -= fxs_amt_i256;
        stockMintSum -= fxs_amt_i256;

        // Sync
        syncDollarBalances();
    }

    // ------------------------------------------------------------------
    // --------------------------- Collateral ---------------------------
    // ------------------------------------------------------------------

    function giveCollatToAMO(
        address destination_amo,
        uint256 collat_amount
    ) external onlyOperator validAMO(destination_amo) {
        int256 collat_amount_i256 = int256(collat_amount);

        require((collatBorrowedSum + collat_amount_i256) <= collatBorrowCap, "Borrow cap");
        collatBorrowedBalances[destination_amo] += collat_amount_i256;
        collatBorrowedSum += collat_amount_i256;

        // Borrow the collateral
        pool.amoMinterBorrow(collat_amount);

        // Give the collateral to the AMO
        TransferHelper.safeTransfer(collateralAddress, destination_amo, collat_amount);

        // Sync
        syncDollarBalances();
    }

    function receiveCollatFromAMO(uint256 usdc_amount) external validAMO(msg.sender) {
        int256 collat_amt_i256 = int256(usdc_amount);

        // Give back first
        TransferHelper.safeTransferFrom(collateralAddress, msg.sender, address(pool), usdc_amount);

        // Then update the balances
        collatBorrowedBalances[msg.sender] -= collat_amt_i256;
        collatBorrowedSum -= collat_amt_i256;

        // Sync
        syncDollarBalances();
    }

    /* ========== RESTRICTED GOVERNANCE FUNCTIONS ========== */

    // Adds an AMO 
    function addAMO(address amo_address, bool sync_too) public onlyOperator {
        require(amo_address != address(0), "Zero address detected");

        (uint256 frax_val_e18, uint256 collat_val_e18) = IAMO(amo_address).dollarBalances();
        require(frax_val_e18 >= 0 && collat_val_e18 >= 0, "Invalid AMO");

        require(amos[amo_address] == false, "Address already exists");
        amos[amo_address] = true;
        amosArray.push(amo_address);

        // Mint balances
        stablecoinMintBalances[amo_address] = 0;
        stockMintBalances[amo_address] = 0;
        collatBorrowedBalances[amo_address] = 0;

        // Offsets
        correctionOffsetsAmos[amo_address][0] = 0;
        correctionOffsetsAmos[amo_address][1] = 0;

        if (sync_too) syncDollarBalances();

        emit AMOAdded(amo_address);
    }

    // Removes an AMO
    function removeAMO(address amo_address, bool sync_too) public onlyOperator {
        require(amo_address != address(0), "Zero address detected");
        require(amos[amo_address] == true, "Address no exist");

        // Delete from the mapping
        delete amos[amo_address];

        // 'Delete' from the array by setting the address to 0x0
        for (uint i = 0; i < amosArray.length; i++) {
            if (amosArray[i] == amo_address) {
                amosArray[i] = address(0);
                // This will leave a null in the array and keep the indices the same
                break;
            }
        }

        if (sync_too) syncDollarBalances();

        emit AMORemoved(amo_address);
    }

    function setFraxMintCap(uint256 _frax_mint_cap) external onlyOperator {
        stableCoinMintCap = int256(_frax_mint_cap);
    }

    function setFxsMintCap(uint256 _fxs_mint_cap) external onlyOperator {
        fxsMintCap = int256(_fxs_mint_cap);
    }

    function setCollatBorrowCap(uint256 _collat_borrow_cap) external onlyOperator {
        collatBorrowCap = int256(_collat_borrow_cap);
    }

    function setMinimumCollateralRatio(uint256 _min_cr) external onlyOperator {
        minCR = _min_cr;
    }

    function setAMOCorrectionOffsets(address amo_address, int256 frax_e18_correction, int256 collat_e18_correction) external onlyOperator {
        correctionOffsetsAmos[amo_address][0] = frax_e18_correction;
        correctionOffsetsAmos[amo_address][1] = collat_e18_correction;

        syncDollarBalances();
    }

    function setFraxPool(address _pool_address) external onlyOperator {
        pool = IStablecoinPool(_pool_address);

        // Make sure the collaterals match, or balances could get corrupted
        //todo
        //        require(old_pool.collateralAddrToIdx(collateralAddress) == col_idx, "collateral address mismatch");
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
        (bool success, bytes memory result) = _to.call{value : _value}(_data);
        return (success, result);
    }

    /* ========== EVENTS ========== */

    event AMOAdded(address amo_address);
    event AMORemoved(address amo_address);
    event Recovered(address token, uint256 amount);
}