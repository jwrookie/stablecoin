// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

import "./Pools/StablecoinPool.sol";
import "../Oracle/UniswapPairOracle.sol";
import "../Oracle/ChainlinkETHUSDPriceConsumer.sol";
import "../tools/AbstractPausable.sol";

contract RStablecoin is ERC20Burnable, AbstractPausable {
    using SafeMath for uint256;

    event StableBurned(address indexed from, address indexed to, uint256 amount);
    event StableMinted(address indexed from, address indexed to, uint256 amount);

    event CollateralRatioRefreshed(uint256 globalCollateralRatio);
    event PoolAdded(address pool);
    event PoolRemoved(address pool);
    event RedemptionFeeSet(uint256 redFee);
    event MintingFeeSet(uint256 minFee);
    event StableStepSet(uint256 newStep);
    event PriceTargetSet(uint256 priceTarget);
    event RefreshCooldownSet(uint256 cooldown);
    event StockAddressSet(address _address);
    event ETHUSDOracleSet(address ethusdConsumer);
    event TimelockSet(address timelock);
    event ControllerSet(address controller);
    event PriceBandSet(uint256 priceBand);
    event StableETHOracleSet(address oracle, address weth);
    event StockEthOracleSet(address oracle, address weth);
    event SetK(uint256 kDuration, uint256 k);

    uint256 public constant GENESIS_SUPPLY = 2000000e18;
    // Constants for various precisions
    uint256 public constant PRICE_PRECISION = 1e6;


    enum PriceChoice {
        STABLE,
        STOCK
    }
    ChainlinkETHUSDPriceConsumer public ethUsdPricer;
    uint8 public ethUsdPricerDecimals;
    UniswapPairOracle public stableEthOracle;
    UniswapPairOracle public stockEthOracle;

    address public stockAddress;
    address public stableEthOracleAddress;
    address public stockEthOracleAddress;
    address public weth;
    address public ethUsdConsumerAddress;

    // The addresses in this array are added by the oracle and these contracts are able to mint stable
    address[] public poolAddress;

    // Mapping is also used for faster verification
    mapping(address => bool) public isStablePools;

    uint256 public globalCollateralRatio; // 6 decimals of precision, e.g. 924102 = 0.924102
    uint256 public redemptionFee; // 6 decimals of precision, divide by 1000000 in calculations for fee
    uint256 public mintingFee; // 6 decimals of precision, divide by 1000000 in calculations for fee
    uint256 public stableStep; // Amount to change the collateralization ratio by upon refreshCollateralRatio()
    uint256 public refreshCooldown; // Seconds to wait before being able to run refreshCollateralRatio() again
    uint256 public priceTarget; // The price of FRAX at which the collateral ratio will respond to; this value is only used for the collateral ratio mechanism and not for minting and redeeming which are hardcoded at $1
    uint256 public priceBand; // The bound above and below the price target at which the refreshCollateralRatio() will not change the collateral ratio

    uint256 public lastCallTime; // Last time the refreshCollateralRatio function was called

    uint256 public K = 1e3; // 1=1e6
    uint256 public maxCR = 1e16;
    uint256 public lastQX;
    uint256 public kDuration = 1e7 * 1e18;

    modifier onlyPools() {
        require(isStablePools[msg.sender] == true, "Only stable pools can call this function");
        _;
    }

    modifier onlyByOperatorOrPool() {
        require(
            msg.sender == operator() || isStablePools[msg.sender] == true,
            "Not the owner, the governance  or a pool"
        );
        _;
    }

    constructor(
        address _operatorMsg,
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol) AbstractPausable(_operatorMsg) {
        _mint(msg.sender, GENESIS_SUPPLY);
        stableStep = 2500;
        // 6 decimals of precision, equal to 0.25%
        globalCollateralRatio = 1000000;
        refreshCooldown = 3600;
        // Refresh cooldown period is set to 1 hour (3600 seconds) at genesis
        priceTarget = 1000000;
        // Collateral ratio will adjust according to the $1 price target at genesis
        priceBand = 5000;
        // Collateral ratio will not adjust if between $0.995 and $1.005 at genesis
        lastQX = GENESIS_SUPPLY;
    }

    function oraclePrice(PriceChoice choice) internal view returns (uint256) {
        // Get the ETH / USD price first, and cut it down to 1e6 precision
        uint256 __ethusdPrice = uint256(ethUsdPricer.getLatestPrice()).mul(PRICE_PRECISION).div(
            uint256(10) ** ethUsdPricerDecimals
        );
        uint256 priceVSeth = 0;

        if (choice == PriceChoice.STABLE) {
            priceVSeth = uint256(stableEthOracle.consult(weth, PRICE_PRECISION));
        } else if (choice == PriceChoice.STOCK) {
            priceVSeth = uint256(stockEthOracle.consult(weth, PRICE_PRECISION));
        } else revert("INVALID PRICE CHOICE. Needs to be either 0  or 1 ");

        // Will be in 1e6 format
        return __ethusdPrice.mul(PRICE_PRECISION).div(priceVSeth);
    }

    // Returns X stable = 1 USD
    function stablePrice() public view returns (uint256) {
        return oraclePrice(PriceChoice.STABLE);
    }

    // Returns X stock = 1 USD
    function stockPrice() public view returns (uint256) {
        return oraclePrice(PriceChoice.STOCK);
    }

    function ethUsdPrice() public view returns (uint256) {
        return uint256(ethUsdPricer.getLatestPrice()).mul(PRICE_PRECISION).div(uint256(10) ** ethUsdPricerDecimals);
    }

    // This is needed to avoid costly repeat calls to different getter functions
    // It is cheaper gas-wise to just dump everything and only use some of the info
    function stableInfo()
    public
    view
    returns (
        uint256,
        uint256,
        uint256,
        uint256,
        uint256,
        uint256,
        uint256,
        uint256
    )
    {
        return (
        oraclePrice(PriceChoice.STABLE),
        oraclePrice(PriceChoice.STOCK),
        totalSupply(),
        globalCollateralRatio,
        globalCollateralValue(),
        mintingFee,
        redemptionFee,
        uint256(ethUsdPricer.getLatestPrice()).mul(PRICE_PRECISION).div(uint256(10) ** ethUsdPricerDecimals) //eth_usd_price
        );
    }

    function stablePoolAddressCount() public view returns (uint256) {
        return (poolAddress.length);
    }

    function globalCollateralValue() public view returns (uint256) {
        uint256 total_collateral_value_d18 = 0;

        for (uint256 i = 0; i < poolAddress.length; i++) {
            // Exclude null addresses
            if (poolAddress[i] != address(0)) {
                total_collateral_value_d18 = total_collateral_value_d18.add(
                    StablecoinPool(poolAddress[i]).collatDollarBalance()
                );
            }
        }
        return total_collateral_value_d18;
    }

    function refreshOtherCR() private {
        uint256 qx = totalSupply();
        uint256 diff;
        bool isReduce;
        if (qx > lastQX) {
            isReduce = true;
            diff = qx.sub(lastQX);
        } else {
            diff = lastQX.sub(qx);
        }
        uint256 period = diff.div(kDuration);
        for (uint256 i = 0; i < period; i++) {
            if (isReduce) {
                maxCR = maxCR.mul(1e6 - K);
            } else {
                maxCR = maxCR.div(1e6 - K);
            }
        }
        if (maxCR > PRICE_PRECISION) {
            maxCR = PRICE_PRECISION;
        }
        lastQX = qx;
    }

    // There needs to be a time interval that this can be called. Otherwise it can be called multiple times per expansion.
    function refreshCollateralRatio() public whenNotPaused {
        uint256 stablePriceCur = stablePrice();
        require(
            block.timestamp - lastCallTime >= refreshCooldown,
            "Must wait for the refresh cooldown since last refresh"
        );

        refreshOtherCR();
        // Step increments are 0.25% (upon genesis, changable by setStableStep())

        if (stablePriceCur > priceTarget.add(priceBand)) {
            //decrease collateral ratio
            if (globalCollateralRatio <= stableStep) {
                //if within a step of 0, go to 0
                globalCollateralRatio = 0;
            } else {
                globalCollateralRatio = globalCollateralRatio.sub(stableStep);
            }
        } else if (stablePriceCur < priceTarget.sub(priceBand)) {
            //increase collateral ratio
            if (globalCollateralRatio.add(stableStep) >= 1000000) {
                globalCollateralRatio = 1000000;
                // cap collateral ratio at 1.000000
            } else {
                globalCollateralRatio = globalCollateralRatio.add(stableStep);
            }
        }
        if (globalCollateralRatio > maxCR) {
            globalCollateralRatio = maxCR;
        }

        lastCallTime = block.timestamp;
        // Set the time of the last expansion

        emit CollateralRatioRefreshed(globalCollateralRatio);
    }

    // Used by pools when user redeems
    function poolBurnFrom(address _address, uint256 _amount) public onlyPools {
        super.burnFrom(_address, _amount);
        emit StableBurned(_address, msg.sender, _amount);
    }

    function poolBurn(address _address, uint256 _amount) public onlyPools {
        super.burn(_amount);
        emit StableBurned(_address, msg.sender, _amount);
    }

    function poolMint(address _address, uint256 _amount) public onlyPools {
        super._mint(_address, _amount);
        emit StableMinted(msg.sender, _address, _amount);
    }

    // Adds collateral addresses supported, such as tether
    function addPool(address _poolAddress) public onlyOperator {
        require(_poolAddress != address(0), "0 address");
        require(isStablePools[_poolAddress] == false, "Address already exists");
        isStablePools[_poolAddress] = true;
        poolAddress.push(_poolAddress);

        emit PoolAdded(_poolAddress);
    }

    // Remove a pool
    function removePool(address _poolAddress) public onlyOperator {
        require(_poolAddress != address(0), "0 address");
        require(isStablePools[_poolAddress] == true, "Address nonexistant");

        // Delete from the mapping
        delete isStablePools[_poolAddress];

        // 'Delete' from the array by setting the address to 0x0
        for (uint256 i = 0; i < poolAddress.length; i++) {
            if (poolAddress[i] == _poolAddress) {
                poolAddress[i] = address(0);
                // This will leave a null in the array and keep the indices the same
                break;
            }
        }
        emit PoolRemoved(_poolAddress);
    }

    function setRedemptionFee(uint256 redFee) public onlyOperator {
        redemptionFee = redFee;
        emit RedemptionFeeSet(redFee);
    }

    function setMintingFee(uint256 minFee) public onlyOperator {
        mintingFee = minFee;
        emit MintingFeeSet(minFee);
    }

    function setStableStep(uint256 _step) public onlyOperator {
        stableStep = _step;
        emit StableStepSet(_step);
    }

    function setPriceTarget(uint256 _priceTarget) public onlyOperator {
        priceTarget = _priceTarget;
        emit PriceTargetSet(_priceTarget);
    }

    function setRefreshCooldown(uint256 _cooldown) public onlyOperator {
        refreshCooldown = _cooldown;
        emit RefreshCooldownSet(_cooldown);
    }

    function setStockAddress(address _stockAddress) public onlyOperator {
        require(_stockAddress != address(0), "0 address");
        stockAddress = _stockAddress;
        emit StockAddressSet(_stockAddress);
    }

    function setETHUSDOracle(address _ethusdConsumer) public onlyOperator {
        require(_ethusdConsumer != address(0), "0 address");
        ethUsdConsumerAddress = _ethusdConsumer;
        ethUsdPricer = ChainlinkETHUSDPriceConsumer(ethUsdConsumerAddress);
        ethUsdPricerDecimals = ethUsdPricer.getDecimals();
        emit ETHUSDOracleSet(_ethusdConsumer);
    }

    function setPriceBand(uint256 _priceBand) external onlyOperator {
        priceBand = _priceBand;
        emit PriceBandSet(_priceBand);
    }

    function setStableEthOracle(address stableOracle, address _weth) public onlyOperator {
        require((stableOracle != address(0)) && (_weth != address(0)), "0 address");
        stableEthOracleAddress = stableOracle;
        stableEthOracle = UniswapPairOracle(stableOracle);
        weth = _weth;
        emit StableETHOracleSet(stableOracle, _weth);
    }

    function setStockEthOracle(address stockOracle, address _weth) public onlyOperator {
        require((stockOracle != address(0)) && (_weth != address(0)), "0 address");
        stockEthOracleAddress = stockOracle;
        stockEthOracle = UniswapPairOracle(stockOracle);
        weth = _weth;
        emit StockEthOracleSet(stockOracle, _weth);
    }

    function setKAndKDuration(uint256 _k, uint256 _kDuration) public onlyOperator {
        K = _k;
        kDuration = _kDuration;
        emit SetK(kDuration, K);
    }
}
