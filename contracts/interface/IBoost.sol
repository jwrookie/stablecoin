pragma solidity 0.8.10;

interface IBoost {
    function attachTokenToGauge(uint _tokenId, address account) external;

    function detachTokenFromGauge(uint _tokenId, address account) external;

    function emitDeposit(uint _tokenId, address account, uint amount) external;

    function emitWithdraw(uint _tokenId, address account, uint amount) external;

    function distribute(address _gauge) external;
}
