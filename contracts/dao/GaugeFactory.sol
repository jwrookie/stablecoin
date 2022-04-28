pragma solidity 0.8.10;

import "./Gauge.sol";

contract GaugeFactory {
    address public last;

    function createGauge(address _pool, address _ve, address _reward) external returns (address) {
        last = address(new Gauge(_pool, _ve, msg.sender, _reward));
        return last;
    }

}
