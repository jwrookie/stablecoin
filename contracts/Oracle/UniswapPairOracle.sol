// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./Uniswap/Interfaces/IUniswapV2Factory.sol";
import "./Uniswap/Interfaces/IUniswapV2Pair.sol";
import "../math/FixedPoint.sol";

import "./Uniswap/UniswapV2OracleLibrary.sol";
import "./Uniswap/UniswapV2Library.sol";

// Fixed window oracle that recomputes the average price for the entire period once every period
// Note that the price average is only guaranteed to be over at least 1 period, but may be over a longer period
contract UniswapPairOracle is Ownable {
    using FixedPoint for *;

    uint256 public  period = 3600; // 1 hour TWAP (time-weighted average price)
    uint256 public  consultLeniency = 120; // Used for being able to consult past the period end
    bool public allowStaleConsults = false; // If false, consult() will fail if the TWAP is stale

    IUniswapV2Pair public immutable pair;
    address public immutable token0;
    address public immutable token1;

    uint256 public price0CumulativeLast;
    uint256 public price1CumulativeLast;
    uint32 public blockTimestampLast;
    FixedPoint.Uq112x112 public price0Average;
    FixedPoint.Uq112x112 public price1Average;

    modifier onlyByOwnGov() {
        require(
            msg.sender == owner(),
            "You are not an owner"
        );
        _;
    }

    constructor(
        address factory,
        address tokenA,
        address tokenB
    ) public {
        IUniswapV2Pair _pair = IUniswapV2Pair(UniswapV2Library.pairFor(factory, tokenA, tokenB));
        pair = _pair;
        token0 = _pair.token0();
        token1 = _pair.token1();
        price0CumulativeLast = _pair.price0CumulativeLast();
        // Fetch the current accumulated price value (1 / 0)
        price1CumulativeLast = _pair.price1CumulativeLast();
        // Fetch the current accumulated price value (0 / 1)
        uint112 reserve0;
        uint112 reserve1;
        (reserve0, reserve1, blockTimestampLast) = _pair.getReserves();
        require(reserve0 != 0 && reserve1 != 0, "UniswapPairOracle: NO_RESERVES");
    }

    function setPeriod(uint256 _period) external onlyByOwnGov {
        period = _period;
    }

    function setConsultLeniency(uint256 _consultLeniency) external onlyByOwnGov {
        consultLeniency = _consultLeniency;
    }

    function setAllowStaleConsults(bool _allowStaleConsults) external onlyByOwnGov {
        allowStaleConsults = _allowStaleConsults;
    }

    // Check if update() can be called instead of wasting gas calling it
    function canUpdate() public view returns (bool) {
        uint32 blockTimestamp = UniswapV2OracleLibrary.currentBlockTimestamp();
        uint32 timeElapsed = blockTimestamp - blockTimestampLast;
        // Overflow is desired
        return (timeElapsed >= period);
    }

    function update() external {
        (uint256 price0Cumulative, uint256 price1Cumulative, uint32 blockTimestamp) = UniswapV2OracleLibrary
        .currentCumulativePrices(address(pair));
        uint32 timeElapsed = blockTimestamp - blockTimestampLast;
        // Overflow is desired

        // Ensure that at least one full period has passed since the last update
        require(timeElapsed >= period, "UniswapPairOracle: PERIOD_NOT_ELAPSED");

        // Overflow is desired, casting never truncates
        // Cumulative price is in (Uq112x112 price * seconds) units so we simply wrap it after division by time elapsed
        price0Average = FixedPoint.Uq112x112(uint224((price0Cumulative - price0CumulativeLast) / timeElapsed));
        price1Average = FixedPoint.Uq112x112(uint224((price1Cumulative - price1CumulativeLast) / timeElapsed));

        price0CumulativeLast = price0Cumulative;
        price1CumulativeLast = price1Cumulative;
        blockTimestampLast = blockTimestamp;
    }

    // Note this will always return 0 before update has been called successfully for the first time.
    function consult(address token, uint256 amountIn) public view returns (uint256 amountOut) {
        uint32 blockTimestamp = UniswapV2OracleLibrary.currentBlockTimestamp();
        uint32 timeElapsed = blockTimestamp - blockTimestampLast;
        // Overflow is desired

        // Ensure that the price is not stale
        require(
            (timeElapsed < (period + consultLeniency)) || allowStaleConsults,
            "UniswapPairOracle: PRICE_IS_STALE_NEED_TO_CALL_UPDATE"
        );

        if (token == token0) {
            amountOut = price0Average.mul(amountIn).decode144();
        } else {
            require(token == token1, "UniswapPairOracle: INVALID_TOKEN");
            amountOut = price1Average.mul(amountIn).decode144();
        }
    }
}
