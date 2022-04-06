pragma solidity 0.8.10;

interface IGaugeFactory {
    function createGauge(address, address) external returns (address);
}
