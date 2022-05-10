// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "./AggregatorV3Interface.sol";

contract ChainlinkETHUSDPriceConsumer {

    AggregatorV3Interface internal priceFeed;


    constructor (address _aggregator) public {
        priceFeed = AggregatorV3Interface(_aggregator);
    }

    /**
     * Returns the latest price
     */
    function getLatestPrice() public view returns (int) {
        (uint80 roundID, int price, , uint256 updatedAt, uint80 answeredInRound) = priceFeed.latestRoundData();
        require(price >= 0 && updatedAt != 0 && answeredInRound >= roundID, "Invalid chainlink price");

        return price;
    }

    function getDecimals() public view returns (uint8) {
        return priceFeed.decimals();
    }
}